import express from "express";
import { login, logout, signup } from "../controllers/auth.controller.js";

const router=express.Router();

// auth routes

router.post("/signup",signup)
router.post("/logout",logout)
router.post('/login',login)

export default router;