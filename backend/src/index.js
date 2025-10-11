import express from "express";
 
const app=  express();
import authRoutes from "./routes/auth.route.js"

app.use(express.json());




// auth routes 
app.use("/api/auth",authRoutes)

app.get("/",(req,res)=>{
    res.send("hello from backend");
})

app.listen(5001,()=>{
    console.log("server is running on port 5001");
})