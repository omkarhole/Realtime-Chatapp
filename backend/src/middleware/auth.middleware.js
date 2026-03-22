import jwt from "jsonwebtoken"
import User from "../models/user.model.js"
import logger from "../lib/logger.js"

export const protectRoute=async (req,res,next)=>{
    try{
        const cookieToken=req.cookies.jwt;
        const authHeader=req.headers.authorization || "";
        const bearerToken=authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        const token=bearerToken || cookieToken;

        if(!token){
            return res.status(401).json({message:"Not authorized, no token"});
        }
        const decoded=jwt.verify(token,process.env.JWT_SECRET);

        if(!decoded){
            return res.status(401).json({message:"Not authorized - Invalid token"});
        }
        const user=await User.findById(decoded.userId).select("-password -verifyOtp -verifyOtpExpairy");

        if(!user){
            return res.status(404).json({message:"Not authorized - User not found"});
        }
        req.user=user;
        next();
    }
    catch(err){
        logger.error("Protect route middleware failed", {
            context: "middleware.protectRoute",
            error: err.message,
            stack: err.stack,
        });
        res.status(500).json({message:"Internal server error"});
    }

}
