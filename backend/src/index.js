import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js";

dotenv.config({ path: ".local.env", quiet: true });
dotenv.config({ path: ".env", quiet: true });

app.use(express.json({ limit: "10mb" }));
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

const PORT = process.env.PORT || 5001;



// auth routes 
app.use("/api/auth",authRoutes)

// messages routes
app.use("/api/messages",messageRoutes)


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
    console.error(
      `Port ${PORT} is already in use. Stop the existing backend process first, then restart nodemon.`
    );
    process.exit(1);
  }

  console.error("Server startup error:", err);
  process.exit(1);
});

server.listen(PORT,()=>{
    console.log(`server is running on port ${PORT}`);
    connectDB()
})
