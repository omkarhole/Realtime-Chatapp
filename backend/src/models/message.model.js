import mongoose from "mongoose";

const messageSchema=new mongoose.Schema({
    senderId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    receiverId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    text:{
        type:String,
    },
    image:{
        type:String,
    },
    pdf:{
        type:String,
    },
    audio:{
        type:String,
    },
    audioDuration:{
        type:Number,
        default: 0
    },
    status:{
        type:String,
        enum:['sent','delivered','read'],
        default:'sent',
    },
    reactions: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        emoji: {
            type: String,
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "message",
        default: null
    },
    deletedFor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: []
    }],

},
{timestamps:true}

);

const Message=mongoose.model("message",messageSchema);

export default Message;
