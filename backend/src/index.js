import express from "express";
 import dotenv from "dotenv";
 import cookieParser from "cookie-parser";
 
 import {connectDB} from "./lib/db.js"
 import authRoutes from "./routes/auth.route.js"
 import messageRoutes from "./routes/message.route.js"

 dotenv.config()
 const app=express();
 
 app.use(express.json());
 app.use(cookieParser());

const PORT=process.env.PORT



// auth routes 
app.use("/api/auth",authRoutes)

// messages routes
app.use("/api/messages",messageRoutes)

app.get("/",(req,res)=>{
    res.send("hello from backend");
})

app.listen(PORT,()=>{
    console.log(`server is running on port ${PORT}`);
    connectDB()
})