import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportUser,
  getReports,
  isUserBlocked,
} from "../controllers/privacy.controller.js";

const router = express.Router();

// Block/Unblock routes
router.post("/block", protectRoute, blockUser);
router.post("/unblock", protectRoute, unblockUser);
router.get("/blocked-users", protectRoute, getBlockedUsers);
router.get("/blocked/:otherUserId", protectRoute, isUserBlocked);

// Report routes
router.post("/report", protectRoute, reportUser);
router.get("/reports", protectRoute, getReports);

export default router;
