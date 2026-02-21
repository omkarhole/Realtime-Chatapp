import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessage, getUsersForSidebar, sendMessage, markMessageAsRead, searchMessages, getAllMessages } from "../controllers/message.controller.js";


const router=express.Router();


router.get("/users",protectRoute,getUsersForSidebar)

router.get("/search",protectRoute,searchMessages)

router.get("/all",protectRoute,getAllMessages)

router.get("/:id",protectRoute,getMessage)

router.post("/send/:id",protectRoute,sendMessage)

router.put("/mark-read/:senderId",protectRoute,markMessageAsRead)

export default router;
