import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";
import { createRoomKey } from "./conversation.js";

dotenv.config({ path: ".local.env", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const app = express();
const server = http.createServer(app);

const isLocalOrigin = (origin = "") =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean);

const logSocketWarning = (message, error) => {
  if (process.env.NODE_ENV !== "production") {
    console.warn(message, error?.message || error);
  }
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || isLocalOrigin(origin) || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  },
});

const userSocketMap = new Map(); // userId -> Set(socketId)

const getOnlineUserIds = () =>
  Array.from(userSocketMap.entries())
    .filter(([, socketSet]) => socketSet && socketSet.size > 0)
    .map(([userId]) => userId);

const addUserSocket = (userId, socketId) => {
  if (!userId || !socketId) return;
  const existingSet = userSocketMap.get(userId) || new Set();
  existingSet.add(socketId);
  userSocketMap.set(userId, existingSet);
};

const removeUserSocket = (userId, socketId) => {
  if (!userId || !socketId) return;
  const existingSet = userSocketMap.get(userId);
  if (!existingSet) return;

  existingSet.delete(socketId);
  if (existingSet.size === 0) {
    userSocketMap.delete(userId);
  } else {
    userSocketMap.set(userId, existingSet);
  }
};

const getTokenFromCookieHeader = (cookieHeader = "") => {
  if (!cookieHeader) return null;
  const jwtCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("jwt="));

  if (!jwtCookie) return null;
  return decodeURIComponent(jwtCookie.substring(4));
};

export function getReciverSocketId(reciverId) {
  const sockets = userSocketMap.get(reciverId?.toString());
  if (!sockets || sockets.size === 0) return null;
  return Array.from(sockets)[0];
}

io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      getTokenFromCookieHeader(socket.handshake.headers?.cookie);

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return next(new Error("Authentication error: Invalid token"));
    }

    const user = await User.findById(decoded.userId).select("-password -verifyOtp -verifyOtpExpairy");
    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    socket.user = user;
    return next();
  } catch (err) {
    return next(new Error(`Authentication error: ${err.message}`));
  }
});

io.on("connection", (socket) => {
  const userId = socket.user?._id?.toString() || socket.handshake.query.userId;
  if (userId) {
    addUserSocket(userId, socket.id);
    socket.join(`user:${userId}`);

    Conversation.find({ participants: userId })
      .select("roomKey")
      .lean()
      .then((conversations) => {
        conversations.forEach((conversation) => {
          socket.join(conversation.roomKey);
        });
      })
      .catch((err) => {
        logSocketWarning("Error joining existing conversation rooms:", err);
      });

    User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch((err) => {
      logSocketWarning("Error updating lastSeen on connect:", err);
    });
  }

  io.emit("getOnlineUsers", getOnlineUserIds());

  socket.on("disconnect", () => {
    removeUserSocket(userId, socket.id);

    if (userId) {
      User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch((err) => {
        logSocketWarning("Error updating lastSeen on disconnect:", err);
      });
    }

    io.emit("getOnlineUsers", getOnlineUserIds());
  });

  socket.on("activity", () => {
    if (!userId) return;
    User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch((err) => {
      logSocketWarning("Error updating lastSeen on activity:", err);
    });
  });

  socket.on("joinConversation", ({ to }) => {
    if (!userId || !to) return;
    socket.join(createRoomKey(userId, to));
  });

  socket.on("leaveConversation", ({ to }) => {
    if (!userId || !to) return;
    socket.leave(createRoomKey(userId, to));
  });

  socket.on("markAsRead", ({ to }) => {
    if (!to) return;
    io.to(`user:${to}`).emit("messageRead", {
      readerId: userId,
      from: userId,
      to,
    });
  });

  socket.on("addReaction", ({ to, messageId, emoji }) => {
    if (!to) return;
    io.to(`user:${to}`).emit("reactionAdded", {
      messageId,
      reaction: { userId, emoji },
      from: userId,
      to,
    });
  });

  socket.on("removeReaction", ({ to, messageId, emoji }) => {
    if (!to) return;
    io.to(`user:${to}`).emit("reactionRemoved", {
      messageId,
      reaction: { userId, emoji },
      from: userId,
      to,
    });
  });
});

export { io, app, server };
