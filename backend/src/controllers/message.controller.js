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

    if (isSearchMode && searchQuery) {
      const query = {
        _id: { $ne: loggedInObjectId },
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
      { $match: { partnerId: { $ne: null } } },
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

    let conversation = await findConversationByUsers(myId, userToChatId);
    if (!conversation) {
      conversation = await ensureConversationForPair(myId, userToChatId);
    }

    if (!conversation) {
      return res.status(200).json([]);
    }

    const messages = await Message.find({ conversationId: conversation._id })
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
    const { text, image, pdf, replyTo } = req.body;
    const receiverId = req.params.id?.toString();
    const senderId = req.user._id.toString();
    const trimmedText = text?.trim();

    if (!trimmedText && !image && !pdf) {
      return res.status(400).json({ message: "Message content is required" });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ message: "Cannot send message to yourself" });
    }

    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found" });
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

    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    if (pdf) {
      const uploadResponse = await cloudinary.uploader.upload(pdf, { resource_type: "raw" });
      pdfUrl = uploadResponse.secure_url;
    }

    const newMessage = await Message.create({
      conversationId: conversation._id,
      senderId,
      receiverId,
      text: trimmedText || "",
      image: imageUrl,
      pdf: pdfUrl,
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
