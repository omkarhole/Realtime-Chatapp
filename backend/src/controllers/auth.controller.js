import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import { sendEmail } from "../lib/email.js";

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizeUsername = (username = "") => username.trim().toLowerCase();
const sanitizeUsername = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");

const createUniqueUsername = async (baseValue) => {
  const sanitizedBase = sanitizeUsername(baseValue).slice(0, 24) || "user";
  let candidate = sanitizedBase;
  let suffix = 1;

  while (await User.exists({ username: candidate })) {
    candidate = `${sanitizedBase}${suffix}`.slice(0, 30);
    suffix += 1;
  }

  return candidate;
};

const buildAuthUserResponse = (user, message, token) => {
  const payload = {
    _id: user._id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    profilePic: user.profilePic,
    lastSeen: user.lastSeen,
    createdAt: user.createdAt,
  };

  if (message) payload.message = message;
  if (token) payload.token = token;
  return payload;
};

export const signup = async (req, res) => {
  const { fullName, username, email, password } = req.body;
  try {
    const normalizedFullName = fullName?.trim();
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedFullName || !normalizedUsername || !normalizedEmail || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    if (!/^[a-z0-9._-]{3,30}$/.test(normalizedUsername)) {
      return res.status(400).json({
        message: "Username must be 3-30 chars and can include a-z, 0-9, dot, underscore, hyphen",
      });
    }

    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        return res.status(400).json({ message: "User already exists with this email" });
      }
      return res.status(400).json({ message: "Username is already taken" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      fullName: normalizedFullName,
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      lastSeen: new Date(),
    });

    const token = generateToken(newUser._id, res);
    return res.status(201).json(buildAuthUserResponse(newUser, "User created successfully", token));
  } catch (err) {
    console.log("error in signup controller", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const { email, identifier, password } = req.body;
  try {
    const loginIdentifier = normalizeEmail(identifier || email || "");

    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({
      $or: [{ email: loginIdentifier }, { username: loginIdentifier }],
    });

    if (!user) {
      return res.status(400).json({ message: "invalid Credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "invalid Credentials" });
    }

    if (!user.username) {
      const fallbackBase = user.email?.split("@")[0] || user.fullName;
      user.username = await createUniqueUsername(fallbackBase);
    }

    const token = generateToken(user._id, res);

    user.lastSeen = new Date();
    await user.save();

    return res.status(200).json(buildAuthUserResponse(user, "Login successful", token));
  } catch (err) {
    console.log("error in login controller", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = async (req, res) => {
  try {
    res.cookie("jwt", "", {
      maxAge: 0,
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      secure: process.env.NODE_ENV === "production",
    });
    return res.status(200).json({ message: "Logout successful" });
  } catch (err) {
    console.log("error in logout controller", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const userId = req.user._id;
    if (!profilePic) {
      return res.status(400).json({ message: "Profile picture is required" });
    }

    const uploadResponse = await cloudinary.uploader.upload(profilePic);
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadResponse.secure_url },
      { new: true }
    ).select("-password -verifyOtp -verifyOtpExpairy");

    return res.status(200).json(updatedUser);
  } catch (err) {
    console.log("error in update profile controller", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = async (req, res) => {
  try {
    const token = generateToken(req.user._id, res);
    return res.status(200).json(buildAuthUserResponse(req.user, null, token));
  } catch (err) {
    console.log("error in check auth controller", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is Required" });
  }

  try {
    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "User Not Found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    user.verifyOtp = String(otp);
    user.verifyOtpExpairy = Date.now() + 10 * 60 * 1000;
    await user.save();

    const mailOption = {
      to: normalizedEmail,
      subject: "Password Reset OTP",
      text: `Hey User, your Password Reset OTP is ${otp}. This OTP is valid for 10 minutes.\nPlease do not share it with anyone.\n\n- Team Chatty`,
    };

    try {
      const emailResponse = await sendEmail(mailOption);
      console.log("Email sent successfully:", emailResponse);
      return res.status(200).json({ message: "OTP sent to email" });
    } catch (err) {
      console.error("otp mailed failed", err.message);
      return res.status(500).json({ message: "Failed to send OTP email" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

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
};
