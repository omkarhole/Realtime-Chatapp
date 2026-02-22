import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);

// Socket.io CORS configuration for production
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

export function getReciverSocketId(reciverId){
    return userSocketMap[reciverId];
}
// used to store onlin users 
// as soon as user login we will add him to this map
const userSocketMap={};  // userId : socketId (key :value)

// Socket authentication middleware
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (!decoded) {
            return next(new Error("Authentication error: Invalid token"));
        }

        const user = await User.findById(decoded.userId).select("-password");
        
        if (!user) {
            return next(new Error("Authentication error: User not found"));
        }

        // Attach user to socket for use in event handlers
        socket.user = user;
        next();
    } catch (err) {
        console.log("Socket authentication error:", err.message);
        next(new Error("Authentication error: " + err.message));
    }
});

io.on("connection",(socket)=>{
    console.log("a user connected",socket.id);
    // Use authenticated user from middleware
    const userId = socket.user?._id || socket.handshake.query.userId;
    if(userId){
        userSocketMap[userId]=socket.id;
    }
    // io.emit() is used to send event to all connected clients
    io.emit("getOnlineUsers",Object.keys(userSocketMap));

    socket.on("disconnect",()=>{
        console.log("user disconnected",socket.id);
        delete userSocketMap[userId];
            io.emit("getOnlineUsers",Object.keys(userSocketMap));
    })

    // Typing events
    socket.on("typing", ({ to }) => {
        const receiverSocketId = getReciverSocketId(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("typing", { 
                from: userId,
                to: to 
            });
        }
    });

    socket.on("stopTyping", ({ to }) => {
        const receiverSocketId = getReciverSocketId(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("stopTyping", { 
                from: userId,
                to: to 
            });
        }
    });

    // Mark messages as read
    socket.on("markAsRead", ({ to }) => {
        const receiverSocketId = getReciverSocketId(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("messageRead", { 
                readerId: userId,
                from: userId,
                to: to 
            });
        }
    });

    // Reaction events
    socket.on("addReaction", ({ to, messageId, emoji }) => {
        const receiverSocketId = getReciverSocketId(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("reactionAdded", {
                messageId,
                reaction: {
                    userId,
                    emoji
                },
                from: userId,
                to: to
            });
        }
    });

    socket.on("removeReaction", ({ to, messageId, emoji }) => {
        const receiverSocketId = getReciverSocketId(to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("reactionRemoved", {
                messageId,
                reaction: {
                    userId,
                    emoji
                },
                from: userId,
                to: to
            });
        }
    });

});

 
export {io,app,server};
