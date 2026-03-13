import mongoose from "mongoose";
import cloudinary from "../lib/cloudinary.js";
import { createRoomKey } from "../lib/conversation.js";
import { getReciverSocketId, io } from "../lib/socket.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findConversationByUsers = async (firstUserId, secondUserId) => {
  const roomKey = createRoomKey(firstUserId, secondUserId);
  return Conversation.findOne({ roomKey });
};

const attachLegacyMessagesToConversation = async (firstUserId, secondUserId, conversationId) => {
  await Message.updateMany(
    {
      $and: [
        {
          $or: [
            { senderId: firstUserId, receiverId: secondUserId },
            { senderId: secondUserId, receiverId: firstUserId },
          ],
        },
        {
          $or: [{ conversationId: { $exists: false } }, { conversationId: null }],
        },
      ],
    },
    { $set: { conversationId } }
  );
};

const ensureConversationForPair = async (firstUserId, secondUserId) => {
  const roomKey = createRoomKey(firstUserId, secondUserId);
  let conversation = await Conversation.findOne({ roomKey });
  if (conversation) return conversation;

  const latestLegacyMessage = await Message.findOne({
    $or: [
      { senderId: firstUserId, receiverId: secondUserId },
      { senderId: secondUserId, receiverId: firstUserId },
    ],
  }).sort({ createdAt: -1 });

  if (!latestLegacyMessage) return null;

  conversation = await Conversation.create({
    participants: [firstUserId, secondUserId],
    roomKey,
    lastMessage: latestLegacyMessage._id,
    lastMessageAt: latestLegacyMessage.createdAt,
  });

  await attachLegacyMessagesToConversation(firstUserId, secondUserId, conversation._id);
  return conversation;
};

// get all users except logged in user for sidebar
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id.toString();
    const loggedInObjectId = new mongoose.Types.ObjectId(loggedInUserId);
    const searchQuery = req.query.q?.trim();
    const isSearchMode = req.query.search === "true";

    // Get logged-in user's blocked users and users who blocked them
    const loggedInUser = await User.findById(loggedInObjectId);
    const blockedUserIds = loggedInUser.blockedUsers.map(id => new mongoose.Types.ObjectId(id));
    
    // Get all users who have blocked the logged-in user
    const usersWhoBlockedMe = await User.find({
      blockedUsers: loggedInObjectId
    });
    const usersWhoBlockedMeIds = usersWhoBlockedMe.map(u => new mongoose.Types.ObjectId(u._id));

    const allBlockedIds = [...blockedUserIds, ...usersWhoBlockedMeIds];

    if (isSearchMode && searchQuery) {
      const query = {
        _id: { $ne: loggedInObjectId, $nin: allBlockedIds },
      };

      const safeQuery = escapeRegex(searchQuery);
      query.$or = [
        { username: { $regex: safeQuery, $options: "i" } },
        { email: { $regex: safeQuery, $options: "i" } },
        { fullName: { $regex: safeQuery, $options: "i" } },
      ];

      const filterUsers = await User.find(query)
        .select("-password -verifyOtp -verifyOtpExpairy")
        .sort({ fullName: 1 })
        .limit(30);

      return res.status(200).json({ filterUsers });
    }

    const conversationPartners = await Conversation.aggregate([
      { $match: { participants: loggedInObjectId } },
      { $sort: { lastMessageAt: -1 } },
      {
        $project: {
          partnerId: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$participants",
                  as: "participant",
                  cond: { $ne: ["$$participant", loggedInObjectId] },
                },
              },
              0,
            ],
          },
          lastMessageAt: 1,
        },
      },
      { $match: { partnerId: { $ne: null, $nin: allBlockedIds } } },
    ]);

    const legacyConversationPartners = await Message.aggregate([
      {
        $match: {
          conversationId: null,
          $or: [{ senderId: loggedInObjectId }, { receiverId: loggedInObjectId }],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          partnerId: {
            $cond: [{ $eq: ["$senderId", loggedInObjectId] }, "$receiverId", "$senderId"],
          },
          lastMessageAt: "$createdAt",
        },
      },
      {
        $group: {
          _id: "$partnerId",
          lastMessageAt: { $first: "$lastMessageAt" },
        },
      },
      { $project: { partnerId: "$_id", lastMessageAt: 1, _id: 0 } },
      { $match: { partnerId: { $nin: allBlockedIds } } },
    ]);

    const mergedMap = new Map();
    [...conversationPartners, ...legacyConversationPartners].forEach((item) => {
      const partnerId = item.partnerId?.toString?.();
      if (!partnerId) return;
      const previous = mergedMap.get(partnerId);
      if (!previous || new Date(item.lastMessageAt) > new Date(previous.lastMessageAt)) {
        mergedMap.set(partnerId, { partnerId, lastMessageAt: item.lastMessageAt });
      }
    });

    const orderedPartnerIds = Array.from(mergedMap.values())
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      .map((item) => item.partnerId);

    if (orderedPartnerIds.length === 0) {
      return res.status(200).json({ filterUsers: [] });
    }

    const users = await User.find({
      _id: { $in: orderedPartnerIds },
    }).select("-password -verifyOtp -verifyOtpExpairy");

    const userMap = new Map(users.map((user) => [user._id.toString(), user]));
    const filterUsers = orderedPartnerIds.map((id) => userMap.get(id)).filter(Boolean);

    return res.status(200).json({ filterUsers });
  } catch (err) {
    console.error("Error fetching users for sidebar:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// get messages between two users
export const getMessage = async (req, res) => {
  try {
    const userToChatId = req.params.id?.toString();
    const myId = req.user._id.toString();

    const myUser = await User.findById(myId);
    const otherUser = await User.findById(userToChatId);

    // Check if users have blocked each other
    if (myUser.blockedUsers.includes(userToChatId) || otherUser.blockedUsers.includes(myId)) {
      return res.status(403).json({ message: "Cannot access messages with this user" });
    }

    let conversation = await findConversationByUsers(myId, userToChatId);
    if (!conversation) {
      conversation = await ensureConversationForPair(myId, userToChatId);
    }

    if (!conversation) {
      return res.status(200).json([]);
    }

    const userId = req.user._id;
    const messages = await Message.find({ 
      conversationId: conversation._id,
      deletedForMe: { $ne: userId }
    })
      .sort({ createdAt: 1 })
      .populate("senderId", "fullName profilePic username")
      .populate("receiverId", "fullName profilePic username");

    return res.status(200).json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, pdf, audio, audioDuration, replyTo } = req.body;
    const receiverId = req.params.id?.toString();
    const senderId = req.user._id.toString();
    const trimmedText = text?.trim();

    if (!trimmedText && !image && !pdf && !audio) {
      return res.status(400).json({ message: "Message content is required" });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ message: "Cannot send message to yourself" });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    const sender = await User.findById(senderId);
    
    // Check if sender has blocked the receiver
    if (sender.blockedUsers.includes(receiverId)) {
      return res.status(403).json({ message: "You have blocked this user" });
    }
    
    // Check if receiver has blocked the sender
    if (receiver.blockedUsers.includes(senderId)) {
      return res.status(403).json({ message: "This user has blocked you" });
    }

    let conversation = await findConversationByUsers(senderId, receiverId);
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
        roomKey: createRoomKey(senderId, receiverId),
      });
    }

    let imageUrl;
    let pdfUrl;
    let audioUrl;

    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    if (pdf) {
      const uploadResponse = await cloudinary.uploader.upload(pdf, { resource_type: "raw" });
      pdfUrl = uploadResponse.secure_url;
    }

    if (audio) {
      const uploadResponse = await cloudinary.uploader.upload(audio, { resource_type: "video" });
      audioUrl = uploadResponse.secure_url;
    }

    const newMessage = await Message.create({
      conversationId: conversation._id,
      senderId,
      receiverId,
      text: trimmedText || "",
      image: imageUrl,
      pdf: pdfUrl,
      audio: audioUrl,
      audioDuration: audioDuration || 0,
      replyTo: replyTo || null,
    });

    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: newMessage._id,
      lastMessageAt: newMessage.createdAt,
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate("senderId", "fullName profilePic username")
      .populate("receiverId", "fullName profilePic username");

    // Emit once per user room to avoid duplicate events from room + direct socket emits.
    io.to(`user:${senderId}`).emit("newMessage", populatedMessage);
    io.to(`user:${receiverId}`).emit("newMessage", populatedMessage);

    return res.status(201).json(populatedMessage);
  } catch (err) {
    console.error("Error sending message:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Mark messages as read
export const markMessageAsRead = async (req, res) => {
  try {
    const { senderId } = req.params;
    const receiverId = req.user._id;

    const updatedMessages = await Message.updateMany(
      { senderId, receiverId, status: { $ne: "read" } },
      { $set: { status: "read" } }
    );

    const senderSocketId = getReciverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageRead", {
        readerId: receiverId,
        messageIds: updatedMessages.modifiedCount,
      });
    }

    return res.status(200).json({
      message: "Messages marked as read",
      count: updatedMessages.modifiedCount,
    });
  } catch (err) {
    console.error("Error marking messages as read:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Search messages by text content
export const searchMessages = async (req, res) => {
  try {
    const { q: searchQuery } = req.query;
    const userId = req.user._id;

    if (!searchQuery || searchQuery.trim() === "") {
      return res.status(400).json({ message: "Search query is required" });
    }

    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
      text: { $regex: searchQuery, $options: "i" },
    })
      .populate("senderId", "fullName profilePic")
      .populate("receiverId", "fullName profilePic")
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json(messages);
  } catch (err) {
    console.error("Error searching messages:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Export all messages for the logged-in user
export const getAllMessages = async (req, res) => {
  try {
    const userId = req.user._id;

    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .populate("senderId", "fullName profilePic")
      .populate("receiverId", "fullName profilePic")
      .sort({ createdAt: 1 });

    return res.status(200).json(messages);
  } catch (err) {
    console.error("Error exporting messages:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Add reaction to a message
export const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji) {
      return res.status(400).json({ message: "Emoji is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const existingReaction = message.reactions.find(
      (reaction) => reaction.userId.toString() === userId.toString() && reaction.emoji === emoji
    );

    if (existingReaction) {
      return res.status(400).json({ message: "Reaction already exists" });
    }

    message.reactions = message.reactions.filter(
      (reaction) => reaction.userId.toString() !== userId.toString()
    );

    message.reactions.push({ userId, emoji });
    await message.save();
    await message.populate("reactions.userId", "fullName profilePic");

    const updatedMessage = await Message.findById(messageId)
      .populate("senderId", "fullName profilePic")
      .populate("receiverId", "fullName profilePic")
      .populate("reactions.userId", "fullName profilePic");

    const senderSocketId = getReciverSocketId(message.senderId);
    const receiverSocketId = getReciverSocketId(message.receiverId);

    const reactionData = {
      messageId,
      reaction: {
        userId,
        emoji,
        user: req.user,
      },
    };

    if (senderSocketId) io.to(senderSocketId).emit("reactionAdded", reactionData);
    if (receiverSocketId) io.to(receiverSocketId).emit("reactionAdded", reactionData);

    return res.status(200).json(updatedMessage);
  } catch (err) {
    console.error("Error adding reaction:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Remove reaction from a message
export const removeReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const existingReaction = message.reactions.find(
      (reaction) => reaction.userId.toString() === userId.toString() && reaction.emoji === emoji
    );

    if (!existingReaction) {
      return res.status(400).json({ message: "Reaction not found" });
    }

    message.reactions = message.reactions.filter(
      (reaction) => !(reaction.userId.toString() === userId.toString() && reaction.emoji === emoji)
    );

    await message.save();

    const updatedMessage = await Message.findById(messageId)
      .populate("senderId", "fullName profilePic")
      .populate("receiverId", "fullName profilePic")
      .populate("reactions.userId", "fullName profilePic");

    const senderSocketId = getReciverSocketId(message.senderId);
    const receiverSocketId = getReciverSocketId(message.receiverId);

    const reactionData = {
      messageId,
      reaction: { userId, emoji },
    };

    if (senderSocketId) io.to(senderSocketId).emit("reactionRemoved", reactionData);
    if (receiverSocketId) io.to(receiverSocketId).emit("reactionRemoved", reactionData);

    return res.status(200).json(updatedMessage);
  } catch (err) {
    console.error("Error removing reaction:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Toggle star status for a message
export const toggleStarMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    const userIdStr = userId.toString();
    const isStarred = message.starredBy.some(id => id.toString() === userIdStr);

    if (isStarred) {
      message.starredBy = message.starredBy.filter(id => id.toString() !== userIdStr);
    } else {
      message.starredBy.push(userId);
    }

    await message.save();

    const updatedMessage = await Message.findById(messageId)
      .populate("senderId", "fullName profilePic username")
      .populate("receiverId", "fullName profilePic username")
      .populate("starredBy", "fullName profilePic username");

    const senderSocketId = getReciverSocketId(message.senderId);
    const receiverSocketId = getReciverSocketId(message.receiverId);

    const starData = {
      messageId,
      isStarred: !isStarred,
      userId,
    };

    if (senderSocketId) io.to(senderSocketId).emit("messageStarred", starData);
    if (receiverSocketId) io.to(receiverSocketId).emit("messageStarred", starData);

    return res.status(200).json({
      message: isStarred ? "Message unstarred" : "Message starred",
      isStarred: !isStarred,
      starredBy: updatedMessage.starredBy,
    });
  } catch (err) {
    console.error("Error toggling star:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get all starred messages for user
export const getStarredMessages = async (req, res) => {
  try {
    const userId = req.user._id;

    const messages = await Message.find({
      starredBy: userId,
    })
      .populate("senderId", "fullName profilePic username")
      .populate("receiverId", "fullName profilePic username")
      .populate("starredBy", "fullName profilePic username")
      .sort({ createdAt: -1 });

    return res.status(200).json(messages);
  } catch (err) {
    console.error("Error fetching starred messages:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Forward a message to users or groups
export const deleteMessageForMe = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId).populate("senderId receiverId", "fullName profilePic username");
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Only allow delete for own messages or messages in your conversations
    const isOwnMessage = message.senderId._id.toString() === userId.toString();
    const isInConversation = message.conversationId ? 
      !!(await Conversation.findOne({ _id: message.conversationId, participants: userId })) 
      : false;

    if (!isOwnMessage && !isInConversation) {
      return res.status(403).json({ message: "Unauthorized to delete this message" });
    }

    // Add user to deletedForMe if not already
    if (!message.deletedForMe.some(id => id.toString() === userId.toString())) {
      message.deletedForMe.push(userId);
      await message.save();
    }

    // Emit to relevant users (sender, receiver, conversation participants)
    const senderSocketId = getReciverSocketId(message.senderId._id.toString());
    const receiverSocketId = message.receiverId ? getReciverSocketId(message.receiverId._id.toString()) : null;
    
    const deleteData = {
      messageId,
      deletedForMe: message.deletedForMe.map(id => id.toString()),
      userId: userId.toString()
    };

    if (senderSocketId) io.to(senderSocketId).emit("messageDeletedForMe", deleteData);
    if (receiverSocketId && receiverSocketId !== senderSocketId) io.to(receiverSocketId).emit("messageDeletedForMe", deleteData);

    if (message.conversationId) {
      io.to(message.conversationId.toString()).emit("messageDeletedForMe", deleteData);
    }

    return res.status(200).json({ 
      message: "Message deleted for you",
      deletedForMe: message.deletedForMe 
    });
  } catch (err) {
    console.error("Error deleting message for me:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const forwardMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { recipients } = req.body; // Array of { type: 'user'|'group', id: string }
    const senderId = req.user._id.toString();

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ message: "Recipients are required" });
    }

    // Find the original message
    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      return res.status(404).json({ message: "Original message not found" });
    }

    const forwardedMessages = [];
    const errors = [];

    for (const recipient of recipients) {
      try {
        if (recipient.type === 'user') {
          const receiverId = recipient.id;

          // Don't forward to self
          if (receiverId === senderId) {
            errors.push({ recipient: receiverId, error: "Cannot forward to yourself" });
            continue;
          }

          // Verify receiver exists
          const receiverExists = await User.exists({ _id: receiverId });
          if (!receiverExists) {
            errors.push({ recipient: receiverId, error: "User not found" });
            continue;
          }

          // Find or create conversation
          let conversation = await findConversationByUsers(senderId, receiverId);
          if (!conversation) {
            conversation = await Conversation.create({
              participants: [senderId, receiverId],
              roomKey: createRoomKey(senderId, receiverId),
            });
          }

          // Create forwarded message
          const forwardedMessage = await Message.create({
            conversationId: conversation._id,
            senderId,
            receiverId,
            text: originalMessage.text || "",
            image: originalMessage.image || null,
            pdf: originalMessage.pdf || null,
            audio: originalMessage.audio || null,
            audioDuration: originalMessage.audioDuration || 0,
          });

          // Update conversation
          await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessage: forwardedMessage._id,
            lastMessageAt: forwardedMessage.createdAt,
          });

          // Populate the message for response
          const populatedMessage = await Message.findById(forwardedMessage._id)
            .populate("senderId", "fullName profilePic username")
            .populate("receiverId", "fullName profilePic username");

          forwardedMessages.push(populatedMessage);

          // Notify receiver via socket
          const receiverSocketId = getReciverSocketId(receiverId);
          if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", {
              ...populatedMessage,
              status: "delivered"
            });
          }

        } else if (recipient.type === 'group') {
          const groupId = recipient.id;

          // Verify group exists
          const Group = (await import("../models/group.model.js")).default;
          const group = await Group.findById(groupId);
          if (!group) {
            errors.push({ recipient: groupId, error: "Group not found" });
            continue;
          }

          // Check if user is a member of the group
          const isMember = group.members.some(
            memberId => memberId.toString() === senderId
          );
          if (!isMember) {
            errors.push({ recipient: groupId, error: "You are not a member of this group" });
            continue;
          }

          // Create forwarded group message
          const forwardedMessage = await Message.create({
            senderId,
            text: originalMessage.text || "",
            image: originalMessage.image || null,
            pdf: originalMessage.pdf || null,
            audio: originalMessage.audio || null,
            audioDuration: originalMessage.audioDuration || 0,
            groupId: groupId,
          });

          // Populate the message for response
          const populatedMessage = await Message.findById(forwardedMessage._id)
            .populate("senderId", "fullName profilePic username");

          forwardedMessages.push({ ...populatedMessage, groupId });

          // Notify group members via socket
          group.members.forEach(memberId => {
            if (memberId.toString() !== senderId) {
              const memberSocketId = getReciverSocketId(memberId.toString());
              if (memberSocketId) {
                io.to(memberSocketId).emit("newGroupMessage", populatedMessage);
              }
            }
          });
        }
      } catch (recipientError) {
        console.error(`Error forwarding to ${recipient.id}:`, recipientError);
        errors.push({ recipient: recipient.id, error: recipientError.message });
      }
    }

    // Notify sender about the forwarded messages
    const senderSocketId = getReciverSocketId(senderId);
    if (senderSocketId) {
      forwardedMessages.forEach(msg => {
        io.to(senderSocketId).emit("newMessage", msg);
      });
    }

    return res.status(201).json({
      message: `Message forwarded to ${forwardedMessages.length} recipient(s)`,
      forwardedMessages,
      errors: errors.length > 0 ? errors : undefined,
      count: forwardedMessages.length
    });

  } catch (err) {
    console.error("Error forwarding message:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get media (images and PDFs) from a conversation grouped by date
export const getMedia = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Verify user is part of the conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Check if user is a participant
    const isParticipant = conversation.participants.some(p => p.toString() === userId.toString());
    if (!isParticipant) {
      return res.status(403).json({ message: "Unauthorized access to this conversation" });
    }

    // Fetch all messages with media (images or PDFs) from the conversation
    const messages = await Message.find({
      conversationId: conversationId,
      $or: [
        { image: { $exists: true, $ne: null } },
        { pdf: { $exists: true, $ne: null } }
      ],
      deletedForMe: { $ne: userId }
    })
      .sort({ createdAt: -1 })
      .populate("senderId", "fullName profilePic username")
      .populate("receiverId", "fullName profilePic username");

    // Group messages by date
    const groupedByDate = {};
    messages.forEach(message => {
      const date = new Date(message.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }

      groupedByDate[date].push({
        _id: message._id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        image: message.image || null,
        pdf: message.pdf || null,
        text: message.text || "",
        createdAt: message.createdAt,
        type: message.image ? 'image' : 'pdf'
      });
    });

    // Convert to array format and sort dates in descending order
    const mediaByDate = Object.keys(groupedByDate)
      .sort((a, b) => new Date(b) - new Date(a))
      .map(date => ({
        date,
        media: groupedByDate[date]
      }));

    return res.status(200).json({
      total: messages.length,
      mediaByDate
    });

  } catch (err) {
    console.error("Error fetching media:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
