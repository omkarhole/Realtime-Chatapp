import mongoose from "mongoose";


const userSchema = new mongoose.Schema({
    username: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        sparse: true,
        minlength: 3,
        maxlength: 30
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minLength: 6
    },
    profilePic: {
        type: String,
        default: "",
    },
    verifyOtp: {
        type: String,
        default: "",
    },
    verifyOtpExpairy: {
        type: Number,
        default: 0,
    },
    lastSeen: {
        type: Date,
        default: Date.now
    }
},
    {
        timestamps: true
    }
);
const User = mongoose.model("User", userSchema);

export default User;
