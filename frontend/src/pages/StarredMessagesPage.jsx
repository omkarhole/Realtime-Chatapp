import { useEffect } from "react";
import { Star, FileText, Download, MessageSquare, Image } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { useNavigate } from "react-router-dom";

const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
};

const StarredMessagesPage = () => {
  const {
    starredMessages,
    getStarredMessages,
    isStarredMessagesLoading,
    setSelectedUser,
  } = useChatStore();
  
  const { authUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    getStarredMessages();
  }, [getStarredMessages]);

  const getContactName = (message) => {
    const senderId = normalizeId(message.senderId);
    const receiverId = normalizeId(message.receiverId);
    const authUserId = normalizeId(authUser._id);
    
    if (senderId === authUserId) {
      return message.receiverId?.fullName || "You";
    }
    return message.senderId?.fullName || "Unknown";
  };

  const getContactAvatar = (message) => {
    const senderId = normalizeId(message.senderId);
    const receiverId = normalizeId(message.receiverId);
    const authUserId = normalizeId(authUser._id);
    
    if (senderId === authUserId) {
      return message.receiverId?.profilePic || "/avatar.png";
    }
    return message.senderId?.profilePic || "/avatar.png";
  };

  const handleMessageClick = (message) => {
    const senderId = normalizeId(message.senderId);
    const receiverId = normalizeId(message.receiverId);
    const authUserId = normalizeId(authUser._id);
    
    // Find the other user in the conversation
    const otherUserId = senderId === authUserId ? receiverId : senderId;
    
    // Navigate to the conversation with this user
    // We'll need to set the selected user and navigate to home
    if (message.senderId?._id) {
      setSelectedUser(message.senderId);
    } else if (message.receiverId?._id) {
      setSelectedUser(message.receiverId);
    }
    
    navigate("/");
  };

  const getMessagePreview = (message) => {
    if (message.image) return "Photo";
    if (message.pdf) return "Document";
    if (message.text) {
      return message.text.length > 50 
        ? `${message.text.substring(0, 50)}...` 
        : message.text;
    }
    return "Message";
  };

  if (isStarredMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="loading loading-spinner loading-lg text-primary"></div>
        <p className="mt-2 text-zinc-400">Loading starred messages...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-base-100">
      <div className="border-b border-base-300 p-4">
        <div className="flex items-center gap-2">
          <Star className="size-6 text-yellow-500" />
          <h1 className="text-xl font-semibold">Starred Messages</h1>
        </div>
        <p className="text-sm text-zinc-500 mt-1">
          {starredMessages.length} starred message{starredMessages.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {starredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <Star className="size-16 text-zinc-600 mb-4" />
            <h2 className="text-xl font-semibold text-zinc-400">No starred messages</h2>
            <p className="text-sm text-zinc-500 mt-2 text-center">
              Star important messages to quickly access them here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-base-300">
            {starredMessages.map((message) => (
              <div
                key={message._id}
                onClick={() => handleMessageClick(message)}
                className="p-4 hover:bg-base-200 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="avatar">
                    <div className="size-10 rounded-full">
                      <img 
                        src={getContactAvatar(message)} 
                        alt={getContactName(message)} 
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{getContactName(message)}</span>
                        <Star className="size-3 text-yellow-500 fill-yellow-500" />
                      </div>
                      <span className="text-xs text-zinc-500">
                        {formatMessageTime(message.createdAt)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      {message.image && <Image size={12} className="text-zinc-500" />}
                      {message.pdf && <FileText size={12} className="text-zinc-500" />}
                      {(!message.image && !message.pdf) && <MessageSquare size={12} className="text-zinc-500" />}
                      <p className="text-sm text-zinc-400 truncate">
                        {getMessagePreview(message)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StarredMessagesPage;
