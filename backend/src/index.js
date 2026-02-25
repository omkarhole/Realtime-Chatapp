import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import groupRoutes from "./routes/group.route.js";
import { app, server } from "./lib/socket.js";
import { UPLOAD, SERVER } from "./constants/index.js";

dotenv.config({ path: ".local.env" });

app.use(express.json({ limit: UPLOAD.JSON_LIMIT }));
app.use(cookieParser());
const __dirname = path.resolve();

// CORS configuration for production
const allowedOrigins = [
  SERVER.DEV_FRONTEND_URL,
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

const PORT = process.env.PORT || SERVER.DEFAULT_PORT;

// auth routes 
app.use("/api/auth",authRoutes)

// messages routes
app.use("/api/messages",messageRoutes)

// group routes
app.use("/api/groups", groupRoutes)


if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

app.get("/",(req,res)=>{
    res.send("hello from backend");
})

server.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`);
    connectDB()
})
