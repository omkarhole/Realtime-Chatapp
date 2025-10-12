import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
export const signup = async (req, res) => {
    const { fullName, email, password } = req.body;
    try {

        if (!fullName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }
        const user = await User.findOne({ email })
        if (user) return res.status(400).json({ message: "User already exists with this email" });

        const salt = await bcrypt.genSalt(10);
        // generate hash password with help of salt
        const hashedPassword = await bcrypt.hash(password, salt)
        // create new user
        const newUser = new User({
            fullName,
            email,
            password: hashedPassword
        })
        if (newUser) {
            generateToken(newUser.id, res)
            await newUser.save();
            res.status(201).json({
                _id: newUser.id,
                fullName: newUser.fullName,
                email: newUser.email,
                profilePic: newUser.profilePic,
                message: "User created successfully"
            })
        }
    }
    catch (err) {
        console.log("error in signup controller", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(400).json({ message: "invalid Credentials" });
        }
        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(400).json({ message: "invalid Credentials" });
        }

        generateToken(user.id, res)

        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            profilePic: user.profilePic,
            message: "Login successful"

        })

    }
    catch (err) {
        console.log("error in login controller", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const logout = async (req, res) => {
   try{
    res.cookie("jwt","",{maxAge:0})
    res.status(200).json({ message: "Logout successful" });
   }
   catch(err){
       console.log("error in logout controller", err);
       res.status(500).json({ message: "Internal server error" });
   }
}

export const updateProfile=async(req,res)=>{
    const {profilePic}=req.body;
    try{
        
    }
    catch(err){
        console.log("error in update profile controller", err);
        res.status(500).json({ message: "Internal server error" });
    }
}