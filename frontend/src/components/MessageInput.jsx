import React, { useRef, useState, useEffect } from 'react'
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { Image, Send, Paperclip, FileText, Mic, StopCircle, Play, Pause } from 'lucide-react';
import { X } from "lucide-react";
import { toast } from "react-hot-toast";
import ReplyPreview from './ReplyPreview';

const MessageInput = () => {
    const [text, setText] = useState("");
    const [imagePreview, setImagePreview] = useState(null);
    const [pdfPreview, setPdfPreview] = useState(null);
    const [pdfName, setPdfName] = useState(null);
    
    // Audio recording states
    const [isRecording, setIsRecording] = useState(false);
    const [audioPreview, setAudioPreview] = useState(null);
    const [audioDuration, setAudioDuration] = useState(0);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    
    const fileInputRef = useRef();
    const pdfInputRef = useRef();
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const audioPreviewRef = useRef(null);
    const { sendMessage, selectedUser, replyingTo, clearReplyingTo } = useChatStore();
    const { socket } = useAuthStore();
    const typingTimeoutRef = useRef(null);
    const MAX_RECORDING_TIME = 60;

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

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioPreviewRef.current) {
                audioPreviewRef.current.pause();
            }
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        };
    }, []);

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

    // Audio recording functions
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                setAudioPreview(audioUrl);
                
                // Calculate duration
                const audio = new Audio(audioUrl);
                audio.onloadedmetadata = () => {
                    setAudioDuration(audio.duration);
                };
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setRecordingTime(0);

            // Start timer
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= MAX_RECORDING_TIME - 1) {
                        stopRecording();
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000);

            toast.success("Recording started");
        } catch (error) {
            console.error("Error starting recording:", error);
            toast.error("Failed to start recording. Please allow microphone access.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
            
            toast.success("Recording stopped");
        }
    };

    const removeAudio = () => {
        setAudioPreview(null);
        setAudioDuration(0);
        setRecordingTime(0);
    };

    const togglePreviewPlayback = () => {
        if (!audioPreviewRef.current) return;
        
        if (isPlayingPreview) {
            audioPreviewRef.current.pause();
            setIsPlayingPreview(false);
        } else {
            audioPreviewRef.current.play();
            setIsPlayingPreview(true);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!text.trim() && !imagePreview && !pdfPreview && !audioPreview) return;

        // Stop typing indicator when sending message
        if (socket && selectedUser) {
            socket.emit("stopTyping", { to: selectedUser._id });
        }

        try {
            await sendMessage({
                text: text.trim(),
                image: imagePreview,
                pdf: pdfPreview,
                audio: audioPreview,
                audioDuration: Math.round(audioDuration),
                replyTo: replyingTo ? replyingTo._id : null,
            });

            // Clear form
            setText("");
            setImagePreview(null);
            setPdfPreview(null);
            setPdfName(null);
            setAudioPreview(null);
            setAudioDuration(0);
            setRecordingTime(0);
            setIsPlayingPreview(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
            if (pdfInputRef.current) pdfInputRef.current.value = "";
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    };

    const canSend = text.trim() || imagePreview || pdfPreview || audioPreview;

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
            
            {/* Audio Preview */}
            {audioPreview && !isRecording && (
                <div className="mb-3 flex items-center gap-2">
                    <div className="relative flex items-center gap-2 p-3 rounded-lg border border-zinc-700 bg-base-200 w-full max-w-[250px]">
                        <button
                            onClick={togglePreviewPlayback}
                            className="btn btn-circle btn-sm btn-ghost"
                        >
                            {isPlayingPreview ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-primary font-medium">Voice Message</span>
                                <span className="text-xs text-zinc-400">
                                    {formatTime(isPlayingPreview ? audioPreviewRef.current?.currentTime || 0 : audioDuration)}
                                </span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full h-1 bg-zinc-600 rounded-full mt-1">
                                <div 
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${audioPreviewRef.current ? (audioPreviewRef.current.currentTime / audioDuration) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                        <button
                            onClick={removeAudio}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
                            flex items-center justify-center"
                            type="button"
                        >
                            <X className="size-3" />
                        </button>
                        <audio 
                            ref={audioPreviewRef} 
                            src={audioPreview} 
                            onEnded={() => setIsPlayingPreview(false)}
                            onTimeUpdate={() => {
                                if (audioPreviewRef.current) {
                                    // Force re-render to update progress
                                    setAudioDuration(audioDuration);
                                }
                            }}
                        />
                    </div>
                </div>
            )}
            
            {/* Recording indicator */}
            {isRecording && (
                <div className="mb-3 flex items-center gap-2">
                    <div className="flex items-center gap-2 p-3 rounded-lg border border-red-500 bg-red-500/10 w-full max-w-[250px]">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-sm text-red-400 font-medium">Recording...</span>
                        <span className="text-sm text-zinc-400 ml-auto">
                            {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
                        </span>
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
                        disabled={isRecording}
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
                        disabled={isRecording}
                    >
                        <Image size={20} />
                    </button>
                    
                    <button
                        type="button"
                        className={`hidden sm:flex btn btn-circle
                        ${pdfPreview ? "text-emerald-500" : "text-zinc-400"}`}
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={isRecording}
                    >
                        <Paperclip size={20} />
                    </button>

                    {/* Microphone button for recording */}
                    <button
                        type="button"
                        className={`hidden sm:flex btn btn-circle ${isRecording ? "text-red-500" : audioPreview ? "text-emerald-500" : "text-zinc-400"}`}
                        onClick={isRecording ? stopRecording : (audioPreview ? removeAudio : startRecording)}
                        title={isRecording ? "Stop recording" : (audioPreview ? "Remove recording" : "Start recording")}
                    >
                        {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
                    </button>
                </div>
                <button
                    type="submit"
                    className="btn btn-sm btn-circle"
                    disabled={!canSend}
                >
                    <Send size={22} />
                </button>
            </form>
        </div>
    )
}

export default MessageInput
