import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import { sendEmail } from "../lib/email.js";
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
            password: hashedPassword,
            lastSeen: new Date()
        })
        if (newUser) {
            generateToken(newUser.id, res)
            await newUser.save();
            res.status(201).json({
                _id: newUser.id,
                fullName: newUser.fullName,
                email: newUser.email,
                profilePic: newUser.profilePic,
                lastSeen: newUser.lastSeen,
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

        // Update last seen on login
        user.lastSeen = new Date();
        await user.save();

        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            profilePic: user.profilePic,
            lastSeen: user.lastSeen,
            message: "Login successful"

        })

    }
    catch (err) {
        console.log("error in login controller", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const logout = async (req, res) => {
    try {
        res.cookie("jwt", "", { maxAge: 0 })
        res.status(200).json({ message: "Logout successful" });
    }
    catch (err) {
        console.log("error in logout controller", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const updateProfile = async (req, res) => {
    try {
        const { profilePic } = req.body;
        const userId = req.user._id;
        if (!profilePic) {
            return res.status(400).json({ message: "Profile picture is required" });
        }
        const uploadResponse = await cloudinary.uploader.upload(profilePic);
        const updatedUser = await User.findByIdAndUpdate(userId, {
            profilePic: uploadResponse.secure_url
        }, { new: true });

        res.status(200).json(updatedUser);

    }
    catch (err) {
        console.log("error in update profile controller", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const checkAuth = async (req, res) => {
    try {
        res.status(200).json(req.user);
    }
    catch (err) {
        console.log("error in check auth controller", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

export const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: "Email is Required" })
    }
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User Not Found" });
        }
        const otp = Math.floor(100000 + Math.random() * 900000);
        user.verifyOtp = String(otp);
        user.verifyOtpExpairy = Date.now() + 10 * 60 * 1000;
        await user.save();
        const mailOption = {
            to: email,
            subject: "Password Reset OTP 🔐",
            text: `Hey User, your Password Reset OTP is ${otp}. This OTP is valid for 10 minutes.\nPlease do not share it with anyone.\n\n— Team Chatty`
        }
        try {
            const emailResponse = await sendEmail(mailOption);
            console.log("Email sent successfully:", emailResponse);
            return res.status(200).json({ message: "OTP sent to email" })
        } catch (err) {
            console.error("otp mailed failed", err.message);
            return res.status(500).json({ message: "Failed to send OTP email" });
        }
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
}

export const resetPassword = async (req, res) => {
    const { otp, password } = req.body;
    if (!otp || !password) {
        return res.status(400).json({ message: "OTP and new password are required" });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }
    try {
        const user = await User.findOne({ verifyOtp: String(otp) });
        if (!user) {
            return res.status(400).json({ message: "Invalid OTP" });
        }
        if (user.verifyOtpExpairy < Date.now()) {
            return res.status(400).json({ message: "OTP Expired" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        user.password = hashedPassword;
        user.verifyOtp = "";
        user.verifyOtpExpairy = 0;
        await user.save();

        return res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.log("error in reset password controller", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
