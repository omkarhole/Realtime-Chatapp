import User from "../models/user.model.js";
import Message from "../models/message.model.js";


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
            //   reciverId: receiverId,
            receiverId,
            text,
            image: imageUrl
        });
        await newMessage.save();

        // todo:real-time message functionality goes here => using socket.io
        res.status(201).json(newMessage);

    }
    catch (err) {
        console.error("Error sending message:", err);
        res.status(500).json({ message: "Internal Server Error" })
    }

}