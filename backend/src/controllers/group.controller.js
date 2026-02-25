import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { uploadImage, uploadPdf, uploadAudio, uploadAvatar } from "../lib/cloudinaryUpload.js";
import { io } from "../lib/socket.js";

// Create a new group
export const createGroup = async (req, res) => {
    try {
        const { name, members, avatar } = req.body;
        const adminId = req.user._id;

        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Group name is required" });
        }

        if (!members || !Array.isArray(members) || members.length < 1) {
            return res.status(400).json({ message: "At least one member is required" });
        }

        // Add admin to members if not already included
        const allMembers = [...new Set([adminId.toString(), ...members])];

        // Upload avatar to Cloudinary
        const avatarUrl = await uploadAvatar(avatar);

        const newGroup = new Group({
            name: name.trim(),
            admin: adminId,
            members: allMembers,
            avatar: avatarUrl
        });

        await newGroup.save();
        
        // Populate members for response
        await newGroup.populate('members', 'fullName profilePic email');
        await newGroup.populate('admin', 'fullName profilePic email');

        res.status(201).json(newGroup);
    } catch (err) {
        console.error("Error creating group:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Get all groups the user is a member of
export const getMyGroups = async (req, res) => {
    try {
        const userId = req.user._id;

        const groups = await Group.find({ members: userId })
            .populate('members', 'fullName profilePic email lastSeen')
            .populate('admin', 'fullName profilePic email')
            .sort({ updatedAt: -1 });

        res.status(200).json(groups);
    } catch (err) {
        console.error("Error fetching groups:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Get a specific group by ID
export const getGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(id)
            .populate('members', 'fullName profilePic email lastSeen')
            .populate('admin', 'fullName profilePic email');

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is a member
        if (!group.members.some(m => m._id.toString() === userId.toString())) {
            return res.status(403).json({ message: "You are not a member of this group" });
        }

        res.status(200).json(group);
    } catch (err) {
        console.error("Error fetching group:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Update group (name, avatar) - admin only
export const updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, avatar } = req.body;
        const userId = req.user._id;

        const group = await Group.findById(id);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is admin
        if (group.admin.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Only admin can update the group" });
        }

        if (name && name.trim()) {
            group.name = name.trim();
        }

        // Upload avatar to Cloudinary
        const newAvatarUrl = await uploadAvatar(avatar);
        if (newAvatarUrl) {
            group.avatar = newAvatarUrl;
        }

        await group.save();
        await group.populate('members', 'fullName profilePic email');
        await group.populate('admin', 'fullName profilePic email');

        // Notify all members about the update
        group.members.forEach(member => {
            if (member._id.toString() !== userId.toString()) {
                io.to(member._id.toString()).emit("groupUpdated", group);
            }
        });

        res.status(200).json(group);
    } catch (err) {
        console.error("Error updating group:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Add member to group - admin only
export const addMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId: memberToAdd } = req.body;
        const adminId = req.user._id;

        const group = await Group.findById(id);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is admin
        if (group.admin.toString() !== adminId.toString()) {
            return res.status(403).json({ message: "Only admin can add members" });
        }

        // Check if user exists
        const userToAdd = await User.findById(memberToAdd);
        if (!userToAdd) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check if already a member
        if (group.members.includes(memberToAdd)) {
            return res.status(400).json({ message: "User is already a member" });
        }

        group.members.push(memberToAdd);
        await group.save();
        await group.populate('members', 'fullName profilePic email');
        await group.populate('admin', 'fullName profilePic email');

        // Notify the added user
        io.to(memberToAdd).emit("groupMemberAdded", {
            group,
            addedBy: req.user
        });

        res.status(200).json(group);
    } catch (err) {
        console.error("Error adding member:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Remove member from group - admin only
export const removeMember = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const adminId = req.user._id;

        const group = await Group.findById(id);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is admin
        if (group.admin.toString() !== adminId.toString()) {
            return res.status(403).json({ message: "Only admin can remove members" });
        }

        // Cannot remove admin
        if (userId === group.admin.toString()) {
            return res.status(400).json({ message: "Cannot remove admin from group" });
        }

        // Check if user is a member
        if (!group.members.includes(userId)) {
            return res.status(400).json({ message: "User is not a member" });
        }

        group.members = group.members.filter(m => m.toString() !== userId);
        await group.save();
        await group.populate('members', 'fullName profilePic email');
        await group.populate('admin', 'fullName profilePic email');

        // Notify the removed user
        io.to(userId).emit("groupMemberRemoved", {
            groupId: id,
            removedBy: req.user
        });

        res.status(200).json(group);
    } catch (err) {
        console.error("Error removing member:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Leave group
export const leaveGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(id);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is admin
        if (group.admin.toString() === userId.toString()) {
            return res.status(400).json({ message: "Admin cannot leave group. Transfer admin role or delete group instead" });
        }

        // Check if user is a member
        if (!group.members.includes(userId)) {
            return res.status(400).json({ message: "You are not a member" });
        }

        group.members = group.members.filter(m => m.toString() !== userId.toString());
        await group.save();

        // Notify remaining members
        group.members.forEach(member => {
            io.to(member.toString()).emit("groupMemberLeft", {
                groupId: id,
                userId,
                leftBy: req.user
            });
        });

        res.status(200).json({ message: "Left group successfully" });
    } catch (err) {
        console.error("Error leaving group:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Delete group - admin only
export const deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(id);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is admin
        if (group.admin.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Only admin can delete the group" });
        }

        // Delete all group messages
        await Message.deleteMany({ groupId: id });

        // Notify all members before deletion
        group.members.forEach(member => {
            if (member.toString() !== userId.toString()) {
                io.to(member.toString()).emit("groupDeleted", {
                    groupId: id,
                    deletedBy: req.user
                });
            }
        });

        await Group.findByIdAndDelete(id);

        res.status(200).json({ message: "Group deleted successfully" });
    } catch (err) {
        console.error("Error deleting group:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Send message to group
export const sendGroupMessage = async (req, res) => {
    try {
        const { id: groupId } = req.params;
        const { text, image, pdf, audio, audioDuration, replyTo } = req.body;
        const senderId = req.user._id;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is a member
        if (!group.members.includes(senderId)) {
            return res.status(403).json({ message: "You are not a member of this group" });
        }

        // Upload files to Cloudinary
        const imageUrl = await uploadImage(image);
        const pdfUrl = await uploadPdf(pdf);
        const audioUrl = await uploadAudio(audio);

        const newMessage = new Message({
            senderId,
            groupId,
            text,
            image: imageUrl,
            pdf: pdfUrl,
            audio: audioUrl,
            audioDuration: audioDuration || 0,
            replyTo: replyTo || null
        });

        await newMessage.save();
        
        // Populate sender details
        await newMessage.populate('senderId', 'fullName profilePic');

        // Update group's last message
        group.lastMessage = {
            text: text || (image ? '📷 Photo' : pdf ? '📄 Document' : audio ? '🎤 Voice Message' : 'New message'),
            senderId,
            createdAt: new Date()
        };
        await group.save();

        // Broadcast message to all group members
        group.members.forEach(member => {
            const memberId = member.toString();
            // Don't send to sender if you don't want them to receive their own message via socket
            // The API response already contains the message for the sender
            if (memberId !== senderId.toString()) {
                io.to(memberId).emit("newGroupMessage", newMessage);
            }
        });

        res.status(201).json(newMessage);
    } catch (err) {
        console.error("Error sending group message:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Get group messages
export const getGroupMessages = async (req, res) => {
    try {
        const { id: groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is a member
        if (!group.members.includes(userId)) {
            return res.status(403).json({ message: "You are not a member of this group" });
        }

        const messages = await Message.find({ groupId })
            .populate('senderId', 'fullName profilePic')
            .populate('replyTo')
            .sort({ createdAt: 1 });

        res.status(200).json(messages);
    } catch (err) {
        console.error("Error fetching group messages:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// Get available users to add to group (users who are not already members)
export const getAvailableUsers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // Check if user is admin
        if (group.admin.toString() !== userId.toString()) {
            return res.status(403).json({ message: "Only admin can view available users" });
        }

        // Get users who are not members of this group (excluding the admin)
        const availableUsers = await User.find({
            _id: { 
                $nin: [...group.members, userId] 
            }
        }).select("-password");

        res.status(200).json(availableUsers);
    } catch (err) {
        console.error("Error fetching available users:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
