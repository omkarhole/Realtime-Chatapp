import React, { useRef, useState, useEffect } from 'react'
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { Image, Send, Paperclip, FileText } from 'lucide-react';
import { X } from "lucide-react";
import { toast } from "react-hot-toast";
import ReplyPreview from './ReplyPreview';

const MessageInput = () => {
    const [text, setText] = useState("");
    const [imagePreview, setImagePreview] = useState(null);
    const [pdfPreview, setPdfPreview] = useState(null);
    const [pdfName, setPdfName] = useState(null);
    const fileInputRef = useRef();
    const pdfInputRef = useRef();
    const { sendMessage, selectedUser, replyingTo, clearReplyingTo } = useChatStore();
    const { socket } = useAuthStore();
    const typingTimeoutRef = useRef(null);

    // Handle typing indicator
    useEffect(() => {
        if (!text.trim() || !selectedUser || !socket) return;

        // Emit typing event
        socket.emit("typing", { to: selectedUser._id });

        // Clear previous timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Emit stopTyping after 2 seconds of no typing
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit("stopTyping", { to: selectedUser._id });
        }, 2000);

        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [text, selectedUser, socket]);

    const handleTextChange = (e) => {
        setText(e.target.value);
        
        // Emit stopTyping when input is cleared
        if (!e.target.value.trim() && socket && selectedUser) {
            socket.emit("stopTyping", { to: selectedUser._id });
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handlePdfChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Accept PDF and document files (pdf, doc, docx)
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
            toast.error("Please select a PDF or document file");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setPdfPreview(reader.result);
            setPdfName(file.name);
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removePdf = () => {
        setPdfPreview(null);
        setPdfName(null);
        if (pdfInputRef.current) pdfInputRef.current.value = "";
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!text.trim() && !imagePreview && !pdfPreview) return;

        // Stop typing indicator when sending message
        if (socket && selectedUser) {
            socket.emit("stopTyping", { to: selectedUser._id });
        }

        try {
            await sendMessage({
                text: text.trim(),
                image: imagePreview,
                pdf: pdfPreview,
                replyTo: replyingTo ? replyingTo._id : null,
            });

            // Clear form
            setText("");
            setImagePreview(null);
            setPdfPreview(null);
            setPdfName(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            if (pdfInputRef.current) pdfInputRef.current.value = "";
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    };
    return (
        <div className='p-4 w-full ' >
            {/* Reply Preview */}
            {replyingTo && (
                <ReplyPreview 
                    message={replyingTo} 
                    onCancel={clearReplyingTo} 
                />
            )}
            
            {imagePreview && (
                <div className="mb-3 flex items-center gap-2">
                    <div className="relative">
                        <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
                        />
                        <button
                            onClick={removeImage}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
                            type="button"
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                </div>
            )}
            
            {pdfPreview && (
                <div className="mb-3 flex items-center gap-2">
                    <div className="relative flex items-center gap-2 p-2 rounded-lg border border-zinc-700 bg-base-200">
                        <FileText size={24} className="text-red-500" />
                        <span className="text-sm text-zinc-300 max-w-[150px] truncate">{pdfName}</span>
                        <button
                            onClick={removePdf}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
                            type="button"
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                </div>
            )}
            
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <div className="flex-1 flex gap-2">
                    <input
                        type="text"
                        className="w-full input input-bordered rounded-lg input-sm sm:input-md"
                        placeholder="Type a message..."
                        value={text}
                        onChange={handleTextChange}
                    />
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                    />
                    
                    <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="hidden"
                        ref={pdfInputRef}
                        onChange={handlePdfChange}
                    />

                    <button
                        type="button"
                        className={`hidden sm:flex btn btn-circle
                     ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Image size={20} />
                    </button>
                    
                    <button
                        type="button"
                        className={`hidden sm:flex btn btn-circle
                     ${pdfPreview ? "text-emerald-500" : "text-zinc-400"}`}
                        onClick={() => pdfInputRef.current?.click()}
                    >
                        <Paperclip size={20} />
                    </button>
                </div>
                <button
                    type="submit"
                    className="btn btn-sm btn-circle"
                    disabled={!text.trim() && !imagePreview && !pdfPreview}
                >
                    <Send size={22} />
                </button>
            </form>
        </div>
    )
}

export default MessageInput
