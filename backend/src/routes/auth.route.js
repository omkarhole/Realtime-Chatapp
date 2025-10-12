import express from "express";
import { checkAuth, login, logout, signup, updateProfile } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router=express.Router();

// auth routes

router.post("/signup",signup)
router.post("/logout",logout)
router.post('/login',login)

router.put("/update-profile",protectRoute,updateProfile);

router.get("/check",protectRoute,checkAuth);

export default router;