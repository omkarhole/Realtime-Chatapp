import React, { useRef, useState, useEffect } from "react";
import { Image, Send, Paperclip, FileText, Loader2, Mic, Square, Play, Trash2 } from "lucide-react";
import { X } from "lucide-react";
import { toast } from "react-hot-toast";
import { useChatStore } from "../store/useChatStore";
import ReplyPreview from "./ReplyPreview";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [pdfName, setPdfName] = useState(null);
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
  const streamRef = useRef(null);

  const { sendMessage, selectedUser, replyingTo, clearReplyingTo, isSendingMessage } = useChatStore();

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Microphone not supported on your device");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          setAudioPreview(reader.result);
          setAudioDuration(recordingTime);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast.error("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const removeAudio = () => {
    setAudioPreview(null);
    setAudioDuration(0);
    setRecordingTime(0);
    setIsPlayingPreview(false);
    audioChunksRef.current = [];
  };

  const toggleAudioPreview = () => {
    if (audioPreviewRef.current) {
      if (isPlayingPreview) {
        audioPreviewRef.current.pause();
        setIsPlayingPreview(false);
      } else {
        audioPreviewRef.current.play();
        setIsPlayingPreview(true);
      }
    }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handlePdfChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

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

  const clearComposer = () => {
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
    audioChunksRef.current = [];
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (isSendingMessage) return;
    if (!text.trim() && !imagePreview && !pdfPreview && !audioPreview) return;

    const success = await sendMessage({
      text: text.trim(),
      image: imagePreview,
      pdf: pdfPreview,
      audio: audioPreview,
      audioDuration: audioDuration,
      replyTo: replyingTo ? replyingTo._id : null,
    });

    if (success) clearComposer();
  };

  return (
    <div className="p-4 w-full">
      {replyingTo && <ReplyPreview message={replyingTo} onCancel={clearReplyingTo} />}

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
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center"
              type="button"
              disabled={isSendingMessage}
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
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 flex items-center justify-center"
              type="button"
              disabled={isSendingMessage}
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      {audioPreview && (
        <div className="mb-3 flex items-center gap-2 p-2 rounded-lg border border-zinc-700 bg-base-200">
          <button
            onClick={toggleAudioPreview}
            className="btn btn-circle btn-sm btn-ghost flex-shrink-0"
            type="button"
            disabled={isSendingMessage}
          >
            {isPlayingPreview ? <Square size={16} /> : <Play size={16} />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300">Voice Message</span>
              <span className="text-xs text-zinc-400">{formatTime(audioDuration)}</span>
            </div>
            <div className="w-full h-1 bg-zinc-600 rounded-full mt-1">
              <div 
                className="h-full bg-primary rounded-full"
                style={{
                  width: audioPreviewRef.current 
                    ? `${(audioPreviewRef.current.currentTime / audioPreviewRef.current.duration) * 100 || 0}%`
                    : "0%"
                }}
              />
            </div>
          </div>
          <button
            onClick={removeAudio}
            className="btn btn-circle btn-sm btn-ghost flex-shrink-0 text-red-500"
            type="button"
            disabled={isSendingMessage}
          >
            <Trash2 size={16} />
          </button>
          <audio
            ref={audioPreviewRef}
            src={audioPreview}
            onEnded={() => setIsPlayingPreview(false)}
          />
        </div>
      )}

      {isRecording && (
        <div className="mb-3 flex items-center gap-2 p-2 rounded-lg border border-red-500 bg-red-500/10 animate-pulse">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-sm text-red-500 font-medium">Recording...</span>
          <span className="text-sm text-red-500 ml-auto">{formatTime(recordingTime)}</span>
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
            disabled={isSendingMessage}
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
            className={`hidden sm:flex btn btn-circle ${
              imagePreview ? "text-emerald-500" : "text-zinc-400"
            }`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isSendingMessage}
          >
            <Image size={20} />
          </button>

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle ${
              pdfPreview ? "text-emerald-500" : "text-zinc-400"
            }`}
            onClick={() => pdfInputRef.current?.click()}
            disabled={isSendingMessage}
          >
            <Paperclip size={20} />
          </button>

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle ${
              isRecording ? "text-red-500" : audioPreview ? "text-emerald-500" : "text-zinc-400"
            }`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isSendingMessage}
            title={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? <Square size={20} /> : <Mic size={20} />}
          </button>
        </div>

        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={isSendingMessage || (!text.trim() && !imagePreview && !pdfPreview && !audioPreview)}
        >
          {isSendingMessage ? <Loader2 size={18} className="animate-spin" /> : <Send size={22} />}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
