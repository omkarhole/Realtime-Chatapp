import React, { useEffect, useRef } from "react";
import { FileText, Download, Reply } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./MessageSkeleton";
import EmojiPicker from "./EmojiPicker";

const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
};

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    markMessagesAsRead,
    subscribeToReadReceipts,
    unSubscribeFromReadReceipts,
    subscribeToReactions,
    unSubscribeFromReactions,
    addReaction,
    removeReaction,
    setReplyingTo,
  } = useChatStore();

  const { authUser, socket } = useAuthStore();
  const messagesEndRef = useRef(null);
  const isMarkingReadRef = useRef(false);

  useEffect(() => {
    getMessages(selectedUser._id);
    subscribeToReadReceipts();
    subscribeToReactions();

    return () => {
      unSubscribeFromReadReceipts();
      unSubscribeFromReactions();
      unSubscribeFromDeletedMessages();
    };
  }, [
    selectedUser._id,
    getMessages,
    subscribeToReadReceipts,
    unSubscribeFromReadReceipts,
    subscribeToReactions,
    unSubscribeFromReactions,
  ]);

  useEffect(() => {
    if (!selectedUser || messages.length === 0) return;

    const hasUnreadFromSelected = messages.some(
      (message) =>
        normalizeId(message.senderId) === normalizeId(selectedUser._id) && message.status !== "read"
    );

    if (hasUnreadFromSelected && !isMarkingReadRef.current) {
      isMarkingReadRef.current = true;
      Promise.resolve(markMessagesAsRead(selectedUser._id)).finally(() => {
        isMarkingReadRef.current = false;
      });
    }
  }, [messages, selectedUser, markMessagesAsRead]);

  useEffect(() => {
    if (!socket || !selectedUser?._id) return;
    socket.emit("joinConversation", { to: selectedUser._id });
    return () => {
      socket.emit("leaveConversation", { to: selectedUser._id });
    };
  }, [socket, selectedUser?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const renderMessageStatus = (status) => {
    if (status === "read") return <span className="text-blue-500 ml-1">✓✓</span>;
    if (status === "delivered") return <span className="text-gray-400 ml-1">✓✓</span>;
    return <span className="text-gray-400 ml-1">✓</span>;
  };

  const getFileName = (url) => {
    if (!url) return "Document";
    const parts = url.split("/");
    const fileName = parts[parts.length - 1];
    return decodeURIComponent(fileName.replace(/\.[^/.]+$/, ""));
  };

  const hasUserReacted = (reactions, emoji) =>
    reactions?.some(
      (reaction) =>
        normalizeId(reaction.userId) === normalizeId(authUser._id) && reaction.emoji === emoji
    );

  const groupReactions = (reactions) => {
    if (!reactions || reactions.length === 0) return [];
    const grouped = {};

    reactions.forEach((reaction) => {
      if (!grouped[reaction.emoji]) grouped[reaction.emoji] = [];
      grouped[reaction.emoji].push(normalizeId(reaction.userId));
    });

    return Object.entries(grouped).map(([emoji, users]) => ({
      emoji,
      count: users.length,
      users,
    }));
  };

  const getReplyMessage = (replyToId) => messages.find((message) => message._id === replyToId);

  const renderReplyPreview = (replyToId) => {
    const replyMessage = getReplyMessage(replyToId);
    if (!replyMessage) return null;

    const senderName =
      normalizeId(replyMessage.senderId) === normalizeId(authUser._id)
        ? "You"
        : replyMessage.senderId?.fullName || "User";

    let previewText = "Message";
    if (replyMessage.image) previewText = "Photo";
    else if (replyMessage.pdf) previewText = "Document";
    else if (replyMessage.text) {
      previewText =
        replyMessage.text.length > 30
          ? `${replyMessage.text.substring(0, 30)}...`
          : replyMessage.text;
    }

    return (
      <div
        className="flex items-start gap-2 p-2 bg-base-200 rounded-lg border-l-2 border-primary mb-2 cursor-pointer"
        onClick={() => setReplyingTo(replyMessage)}
      >
        <Reply size={14} className="text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-primary font-medium">{senderName}</p>
          <p className="text-xs text-zinc-400 truncate">{previewText}</p>
        </div>
      </div>
    );
  };

  // Render audio player
  const renderAudioPlayer = (message) => {
    const duration = message.audioDuration || 0;
    const isPlaying = playingAudioId === message._id;
    const progress = audioProgress[message._id] || 0;

    return (
      <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-700/50 mb-2 min-w-[200px] max-w-[250px]">
        <button
          onClick={() => toggleAudioPlayback(message._id, message.audio)}
          className="btn btn-circle btn-sm btn-ghost flex-shrink-0"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div className="flex-1">
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-zinc-600 rounded-full mb-1">
            <div 
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-400">
              {isPlaying 
                ? formatAudioTime(audioRefs.current[message._id]?.currentTime || 0)
                : formatAudioTime(duration)
              }
            </span>
          </div>
        </div>
        <audio 
          ref={el => audioRefs.current[message._id] = el}
          src={message.audio}
          onEnded={() => handleAudioEnded(message._id)}
          onTimeUpdate={() => handleAudioTimeUpdate(message._id, duration)}
        />
      </div>
    );
  };

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={message._id}
            className={`chat ${
              normalizeId(message.senderId) === normalizeId(authUser._id) ? "chat-end" : "chat-start"
            }`}
            ref={index === messages.length - 1 ? messagesEndRef : null}
          >
            <div className="chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={
                    normalizeId(message.senderId) === normalizeId(authUser._id)
                      ? authUser.profilePic || "/avatar.png"
                      : selectedUser.profilePic || "/avatar.png"
                  }
                  alt="profile Pic"
                />
              </div>
            </div>
            <div className="chat-header mb-1 flex items-center">
              <time className="text-xs opacity-50 ml-1">{formatMessageTime(message.createdAt)}</time>
              {normalizeId(message.senderId) === normalizeId(authUser._id) &&
                renderMessageStatus(message.status)}
            </div>

            <div className="chat-bubble flex flex-col relative group">
              {message.replyTo && renderReplyPreview(message.replyTo)}

              {message.image && (
                <img
                  src={message.image}
                  alt="message attachment"
                  className="sm:max-w-[200px] rounded-md mb-2"
                />
              )}

              {message.pdf && (
                <a
                  href={message.pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg border border-zinc-600 hover:bg-zinc-700 transition-colors mb-2 max-w-[200px]"
                >
                  <FileText size={24} className="text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{getFileName(message.pdf)}</p>
                    <p className="text-xs text-zinc-400">Document</p>
                  </div>
                  <Download size={16} className="text-zinc-400 flex-shrink-0" />
                </a>
              )}

              {message.text && <p>{message.text}</p>}

              <div className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button
                  onClick={() => setReplyingTo(message)}
                  className="btn btn-circle btn-ghost btn-xs text-zinc-400 hover:text-primary"
                  title="Reply"
                >
                  <Reply size={14} />
                </button>
                <EmojiPicker onSelect={(emoji) => addReaction(message._id, emoji)} />
              </div>
            </div>

            {message.reactions && message.reactions.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {groupReactions(message.reactions).map((group, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (hasUserReacted(message.reactions, group.emoji)) {
                        removeReaction(message._id, group.emoji);
                      } else {
                        addReaction(message._id, group.emoji);
                      }
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                      hasUserReacted(message.reactions, group.emoji)
                        ? "bg-blue-500/20 border-blue-500"
                        : "bg-zinc-700/50 border-zinc-600"
                    } hover:bg-zinc-600 transition-colors`}
                  >
                    <span>{group.emoji}</span>
                    <span className="text-zinc-300">{group.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <MessageInput />
    </div>
  );
};

export default ChatContainer;
