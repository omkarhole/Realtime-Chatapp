import express from "express";
import { checkAuth, login, logout, signup, updateProfile, getOnlineUsers, getUserStatus } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate, signupSchema, loginSchema, updateProfileSchema } from "../middleware/validation.js";

const router=express.Router();

// auth routes

router.post("/signup",validate(signupSchema),signup)
router.post("/logout",logout)
router.post('/login',validate(loginSchema),login)

router.put("/update-profile",protectRoute,validate(updateProfileSchema),updateProfile);

router.get("/check",protectRoute,checkAuth);

// Status routes
router.get("/users/online",protectRoute,getOnlineUsers);
router.get("/users/:id/status",protectRoute,getUserStatus);

export default router;
