import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReciverSocketId, io } from "../lib/socket.js";

// get all users except logged in user for sidebar
export const getUsersForSidebar = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;
        const filterUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

        res.status(200).json({ filterUsers })

    }
    catch (err) {
        console.error("Error fetching users for sidebar:", err);
        res.status(500).json({ message: "Internal Server Error" })
    }
}


// get messages between two diff users( logged in user and user to chat)
export const getMessage = async (req, res) => {
    try {
        const { id: userToChatId } = req.params;
        const myId = req.user._id;

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: userToChatId },
                { senderId: userToChatId, receiverId: myId }
            ]
        })

        res.status(200).json(messages);

    }
    catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ message: "Internal Server Error" })
    }
}

export const sendMessage = async (req, res) => {
    try {
        const { text, image, pdf, audio, audioDuration, replyTo } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user._id;

        let imageUrl;
        let pdfUrl;
        let audioUrl;

        //if image exists upload image to cloudinary and get the url
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        //if pdf exists upload pdf to cloudinary and get the url
        if (pdf) {
            const uploadResponse = await cloudinary.uploader.upload(pdf, {
                resource_type: "raw"
            });
            pdfUrl = uploadResponse.secure_url;
        }

        //if audio exists upload audio to cloudinary and get the url
        if (audio) {
            const uploadResponse = await cloudinary.uploader.upload(audio, {
                resource_type: "video"
            });
            audioUrl = uploadResponse.secure_url;
        }

        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl,
            pdf: pdfUrl,
            audio: audioUrl,
            audioDuration: audioDuration || 0,
            replyTo: replyTo || null
        });
        await newMessage.save();
        
        //   realtime chat using socket.io
        const reciverSocketId = getReciverSocketId(receiverId);
        if (reciverSocketId) {
            // sending new msg in realtime to reciver 
            io.to(reciverSocketId).emit("newMessage", newMessage);
        }
        res.status(201).json(newMessage);

    }
    catch (err) {
        console.error("Error sending message:", err);
        res.status(500).json({ message: "Internal Server Error" })
    }

}

// Mark messages as read
export const markMessageAsRead = async (req, res) => {
    try {
        const { senderId } = req.params; // senderId is the user whose messages we want to mark as read
        const receiverId = req.user._id; // current logged in user is the receiver

        // Update all messages from sender to receiver that are not yet read
        const updatedMessages = await Message.updateMany(
            { senderId, receiverId, status: { $ne: 'read' } },
            { $set: { status: 'read' } }
        );

        // Notify the sender that their messages have been read
        const senderSocketId = getReciverSocketId(senderId);
        if (senderSocketId) {
            io.to(senderSocketId).emit("messageRead", {
                readerId: receiverId,
                messageIds: updatedMessages.modifiedCount
            });
        }

        res.status(200).json({ 
            message: "Messages marked as read",
            count: updatedMessages.modifiedCount 
        });

    }
    catch (err) {
        console.error("Error marking messages as read:", err);
        res.status(500).json({ message: "Internal Server Error" })
    }
}

// Search messages by text content
export const searchMessages = async (req, res) => {
    try {
        const { q: searchQuery } = req.query;
        const userId = req.user._id;

        if (!searchQuery || searchQuery.trim() === "") {
            return res.status(400).json({ message: "Search query is required" });
        }

        // Search for messages where the user is either sender or receiver
        // and the text contains the search query (case-insensitive)
        const messages = await Message.find({
            $or: [
                { senderId: userId },
                { receiverId: userId }
            ],
            text: { $regex: searchQuery, $options: 'i' }
        })
        .populate('senderId', 'fullName profilePic')
        .populate('receiverId', 'fullName profilePic')
        .sort({ createdAt: -1 }) // Most recent first
        .limit(50); // Limit results to 50 messages

        res.status(200).json(messages);

    }
    catch (err) {
        console.error("Error searching messages:", err);
        res.status(500).json({ message: "Internal Server Error" })
    }
}

// Export all messages for the logged-in user
export const getAllMessages = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get all messages where user is either sender or receiver
        const messages = await Message.find({
            $or: [
                { senderId: userId },
                { receiverId: userId }
            ]
        })
        .populate('senderId', 'fullName profilePic')
        .populate('receiverId', 'fullName profilePic')
        .sort({ createdAt: 1 }); // Oldest first for export

        res.status(200).json(messages);

    }
    catch (err) {
        console.error("Error exporting messages:", err);
        res.status(500).json({ message: "Internal Server Error" })
    }
}

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

        // Check if user already reacted with this emoji
        const existingReaction = message.reactions.find(
            r => r.userId.toString() === userId.toString() && r.emoji === emoji
        );

        if (existingReaction) {
            return res.status(400).json({ message: "Reaction already exists" });
        }

        // Remove any existing reaction from this user first (if they want to change emoji)
        message.reactions = message.reactions.filter(
            r => r.userId.toString() !== userId.toString()
        );

        // Add new reaction
        message.reactions.push({
            userId,
            emoji
        });

        await message.save();

        // Populate user details for the new reaction
        await message.populate('reactions.userId', 'fullName profilePic');

        // Get the updated message with populated reaction user
        const updatedMessage = await Message.findById(messageId)
            .populate('senderId', 'fullName profilePic')
            .populate('receiverId', 'fullName profilePic')
            .populate('reactions.userId', 'fullName profilePic');

        // Notify sender and receiver about the reaction via socket
        const senderSocketId = getReciverSocketId(message.senderId);
        const receiverSocketId = getReciverSocketId(message.receiverId);

        const reactionData = {
            messageId,
            reaction: {
                userId,
                emoji,
                user: req.user
            }
        };

        if (senderSocketId) {
            io.to(senderSocketId).emit("reactionAdded", reactionData);
        }
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("reactionAdded", reactionData);
        }

        res.status(200).json(updatedMessage);

    }
    catch (err) {
        console.error("Error adding reaction:", err);
        res.status(500).json({ message: "Internal Server Error" })
    }
}

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

        // Check if user has reacted with this emoji
        const existingReaction = message.reactions.find(
            r => r.userId.toString() === userId.toString() && r.emoji === emoji
        );

        if (!existingReaction) {
            return res.status(400).json({ message: "Reaction not found" });
        }

        // Remove the reaction
        message.reactions = message.reactions.filter(
            r => !(r.userId.toString() === userId.toString() && r.emoji === emoji)
        );

        await message.save();

        // Get the updated message
        const updatedMessage = await Message.findById(messageId)
            .populate('senderId', 'fullName profilePic')
            .populate('receiverId', 'fullName profilePic')
            .populate('reactions.userId', 'fullName profilePic');

        // Notify sender and receiver about the removed reaction via socket
        const senderSocketId = getReciverSocketId(message.senderId);
        const receiverSocketId = getReciverSocketId(message.receiverId);

        const reactionData = {
            messageId,
            reaction: {
                userId,
                emoji
            }
        };

        if (senderSocketId) {
            io.to(senderSocketId).emit("reactionRemoved", reactionData);
        }
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("reactionRemoved", reactionData);
        }

        res.status(200).json(updatedMessage);

    }
    catch (err) {
        console.error("Error removing reaction:", err);
        res.status(500).json({ message: "Internal Server Error" })
    }
}

// Delete message for everyone
export const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Check if user is the sender
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You can only delete your own messages" });
        }

        // Check if 24 hours have passed since message creation
        const messageAge = Date.now() - message.createdAt.getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        if (messageAge > twentyFourHours) {
            return res.status(400).json({ message: "You can only delete messages within 24 hours" });
        }

        // Check if already deleted for everyone (both sender and receiver)
        const senderDeleted = message.deletedFor.some(id => id.toString() === userId.toString());
        const receiverDeleted = message.deletedFor.some(id => id.toString() === message.receiverId.toString());

        if (senderDeleted && receiverDeleted) {
            return res.status(400).json({ message: "Message already deleted for everyone" });
        }

        // Add both sender and receiver to deletedFor array (soft delete for both)
        if (!senderDeleted) {
            message.deletedFor.push(userId);
        }
        if (!receiverDeleted) {
            message.deletedFor.push(message.receiverId);
        }

        await message.save();

        // Notify both users via socket
        const senderSocketId = getReciverSocketId(message.senderId);
        const receiverSocketId = getReciverSocketId(message.receiverId);

        const deletionData = {
            messageId,
            deletedFor: message.deletedFor
        };

        if (senderSocketId) {
            io.to(senderSocketId).emit("messageDeleted", deletionData);
        }
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("messageDeleted", deletionData);
        }

        res.status(200).json({ 
            message: "Message deleted for everyone",
            deletedFor: message.deletedFor
        });

    }
    catch (err) {
        console.error("Error deleting message:", err);
        res.status(500).json({ message: "Internal Server Error" })
    }
}
