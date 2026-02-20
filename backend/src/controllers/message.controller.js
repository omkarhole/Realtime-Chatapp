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
        const { text, image } = req.body;
        const { id: receiverId } = req.params;
        const senderId = req.user._id;

        let imageUrl;

        //if image exists upload image to cloudinary and get the url
        if (image) {
            const uploadResponse = await cloudinary.uploader.upload(image);
            imageUrl = uploadResponse.secure_url;
        }

        const newMessage = new Message({
            senderId,
            receiverId,
            text,
            image: imageUrl
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
