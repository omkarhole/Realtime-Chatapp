import mongoose from "mongoose";
import User from "../models/user.model.js";
import Report from "../models/report.model.js";
import Message from "../models/message.model.js";

// Block a user
export const blockUser = async (req, res) => {
  try {
    const { userIdToBlock } = req.body;
    const userId = req.user._id;

    // Validate the user to block exists
    const userToBlock = await User.findById(userIdToBlock);
    if (!userToBlock) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent blocking yourself
    if (userId.toString() === userIdToBlock) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    // Check if already blocked
    const user = await User.findById(userId);
    if (user.blockedUsers.includes(userIdToBlock)) {
      return res.status(400).json({ message: "User is already blocked" });
    }

    // Add to blocked list
    await User.findByIdAndUpdate(userId, {
      $push: { blockedUsers: userIdToBlock },
    });

    return res.status(200).json({ message: "User blocked successfully" });
  } catch (err) {
    console.error("Error blocking user:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Unblock a user
export const unblockUser = async (req, res) => {
  try {
    const { userIdToUnblock } = req.body;
    const userId = req.user._id;

    // Validate the user to unblock exists
    const userToUnblock = await User.findById(userIdToUnblock);
    if (!userToUnblock) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is blocked
    const user = await User.findById(userId);
    if (!user.blockedUsers.includes(userIdToUnblock)) {
      return res.status(400).json({ message: "User is not blocked" });
    }

    // Remove from blocked list
    await User.findByIdAndUpdate(userId, {
      $pull: { blockedUsers: userIdToUnblock },
    });

    return res.status(200).json({ message: "User unblocked successfully" });
  } catch (err) {
    console.error("Error unblocking user:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get list of blocked users
export const getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .populate("blockedUsers", "username fullName profilePic email")
      .select("blockedUsers");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ blockedUsers: user.blockedUsers });
  } catch (err) {
    console.error("Error fetching blocked users:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Report a user
export const reportUser = async (req, res) => {
  try {
    const { reportedUserId, messageId, reason, description } = req.body;
    const reporterId = req.user._id;

    // Validate required fields
    if (!reportedUserId || !reason) {
      return res
        .status(400)
        .json({ message: "reportedUserId and reason are required" });
    }

    // Validate the reported user exists
    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent reporting yourself
    if (reporterId.toString() === reportedUserId) {
      return res.status(400).json({ message: "You cannot report yourself" });
    }

    // Validate messageId if provided
    if (messageId) {
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
    }

    // Check for duplicate report (prevent spam)
    const existingReport = await Report.findOne({
      reporterId,
      reportedUserId,
      reason,
      createdAt: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Within last 24 hours
      },
    });

    if (existingReport) {
      return res.status(400).json({
        message: "You have already reported this user for this reason recently",
      });
    }

    // Create report
    const report = new Report({
      reporterId,
      reportedUserId,
      messageId: messageId || null,
      reason,
      description: description || "",
    });

    await report.save();

    return res.status(201).json({
      message: "Report submitted successfully",
      reportId: report._id,
    });
  } catch (err) {
    console.error("Error reporting user:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get reports (for admins - can be extended later)
export const getReports = async (req, res) => {
  try {
    // This endpoint can be extended for admin functionality
    const userId = req.user._id;

    // Get reports submitted by the user
    const reports = await Report.find({ reporterId: userId })
      .populate("reportedUserId", "username fullName profilePic")
      .populate("messageId")
      .sort({ createdAt: -1 });

    return res.status(200).json({ reports });
  } catch (err) {
    console.error("Error fetching reports:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Check if user is blocked by another user
export const isUserBlocked = async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    const isBlocked = user.blockedUsers.includes(otherUserId);

    return res.status(200).json({ isBlocked });
  } catch (err) {
    console.error("Error checking block status:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
