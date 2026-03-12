import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessage, getUsersForSidebar, sendMessage, markMessageAsRead, searchMessages, getAllMessages, addReaction, removeReaction, deleteMessage, toggleStarMessage, getStarredMessages, forwardMessage, getMedia } from "../controllers/message.controller.js";


const router=express.Router();


router.get("/users",protectRoute,getUsersForSidebar)

router.get("/search",protectRoute,searchMessages)

router.get("/all",protectRoute,getAllMessages)

// Starred messages route
router.get("/starred", protectRoute, getStarredMessages)

// Media gallery route - must be before /:id to avoid conflicts
router.get("/media/:conversationId", protectRoute, getMedia)

router.get("/:id",protectRoute,getMessage)

router.post("/send/:id",protectRoute,sendMessage)

router.put("/mark-read/:senderId",protectRoute,markMessageAsRead)

// Delete message for everyone
router.delete("/:messageId",protectRoute, deleteMessage)

// Delete message for me only
router.delete("/:messageId/me", protectRoute, deleteMessageForMe)

// Reaction routes
router.post("/:messageId/reactions", protectRoute, addReaction)
router.delete("/:messageId/reactions", protectRoute, removeReaction)

// Star routes
router.post("/:messageId/star", protectRoute, toggleStarMessage)

// Forward message route
router.post("/:messageId/forward", protectRoute, forwardMessage)

export default router;
