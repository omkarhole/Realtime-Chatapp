import express from "express";
 import dotenv from "dotenv";
const app=express();

import {connectDB} from "./lib/db.js"
import authRoutes from "./routes/auth.route.js"
dotenv.config()
app.use(express.json());

const PORT=process.env.PORT



// auth routes 
app.use("/api/auth",authRoutes)

app.get("/",(req,res)=>{
    res.send("hello from backend");
})

app.listen(PORT,()=>{
    console.log(`server is running on port ${PORT}`);
    connectDB()
})