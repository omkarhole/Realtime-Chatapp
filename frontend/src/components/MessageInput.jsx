import React, { useRef, useState } from "react";
import { Image, Send, Paperclip, FileText, Loader2 } from "lucide-react";
import { X } from "lucide-react";
import { toast } from "react-hot-toast";
import { useChatStore } from "../store/useChatStore";
import ReplyPreview from "./ReplyPreview";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);
  const [pdfName, setPdfName] = useState(null);

  const fileInputRef = useRef();
  const pdfInputRef = useRef();

  const { sendMessage, selectedUser, replyingTo, clearReplyingTo, isSendingMessage } = useChatStore();

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
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (isSendingMessage) return;
    if (!text.trim() && !imagePreview && !pdfPreview) return;

    const success = await sendMessage({
      text: text.trim(),
      image: imagePreview,
      pdf: pdfPreview,
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
        </div>

        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={isSendingMessage || (!text.trim() && !imagePreview && !pdfPreview)}
        >
          {isSendingMessage ? <Loader2 size={18} className="animate-spin" /> : <Send size={22} />}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
