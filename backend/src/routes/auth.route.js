import express from "express";
import { checkAuth, login, logout, signup, updateProfile } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate, signupSchema, loginSchema, updateProfileSchema } from "../middleware/validation.js";

const router=express.Router();

// auth routes

router.post("/signup",validate(signupSchema),signup)
router.post("/logout",logout)
router.post('/login',validate(loginSchema),login)

router.put("/update-profile",protectRoute,validate(updateProfileSchema),updateProfile);

router.get("/check",protectRoute,checkAuth);

export default router;
