import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { 
    createGroup, 
    getMyGroups, 
    getGroupById, 
    updateGroup, 
    addMember, 
    removeMember, 
    leaveGroup, 
    deleteGroup, 
    sendGroupMessage, 
    getGroupMessages,
    getAvailableUsers 
} from "../controllers/group.controller.js";

const router = express.Router();

// All routes require authentication
router.use(protectRoute);

// Group CRUD
router.post("/", createGroup);
router.get("/", getMyGroups);
router.get("/:id", getGroupById);
router.put("/:id", updateGroup);
router.delete("/:id", deleteGroup);

// Member management
router.post("/:id/members", addMember);
router.delete("/:id/members/:userId", removeMember);
router.post("/:id/leave", leaveGroup);
router.get("/:groupId/available-users", getAvailableUsers);

// Messages
router.post("/:id/messages", sendGroupMessage);
router.get("/:id/messages", getGroupMessages);

export default router;
