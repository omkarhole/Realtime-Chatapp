import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import groupRoutes from "./routes/group.route.js";
import privacyRoutes from "./routes/privacy.route.js";
import { app, server } from "./lib/socket.js";
import { UPLOAD, SERVER } from "./constants/index.js";
import logger from "./lib/logger.js";

dotenv.config({ path: ".local.env", quiet: true });
dotenv.config({ path: ".env", quiet: true });

app.use(express.json({ limit: UPLOAD.JSON_LIMIT }));
app.use(cookieParser());
const __dirname = path.resolve();

const isLocalOrigin = (origin = "") =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

const allowedOrigins = [process.env.FRONTEND_URL].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || isLocalOrigin(origin) || allowedOrigins.includes(origin)) {
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

// privacy routes
app.use("/api/privacy", privacyRoutes)


if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

app.get("/",(req,res)=>{
    res.send("hello from backend");
})

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    logger.error("Server port is already in use", {
      context: "server.startup",
      port: PORT,
      error: err.message,
    });
    process.exit(1);
  }

  logger.error("Server startup error", {
    context: "server.startup",
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

server.listen(PORT,()=>{
    logger.info("Server is running", {
      context: "server.startup",
      port: PORT,
    });
    connectDB()
})
