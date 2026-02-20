import { Server } from "socket.io";
import http from "http";
import express from "express";

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

io.on("connection",(socket)=>{
    console.log("a user connected",socket.id);
    const userId=socket.handshake.query.userId;
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

});

 
export {io,app,server};