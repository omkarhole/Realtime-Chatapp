import { useChatStore } from "../store/useChatStore";
import { MessageCircle } from "lucide-react";

const SearchResults = ({ results, isLoading, onClose }) => {
  const { setSelectedUser } = useChatStore();

  const handleResultClick = (message) => {
    // Determine which user to select (the other party in the conversation)
    const currentUserId = message.senderId._id || message.senderId;
    const receiverId = message.receiverId._id || message.receiverId;
    
    // We need to get the user info from the message and set them as selected
    // For now, we'll just close the search and let user select manually
    onClose();
  };

  if (isLoading) {
    return (
      <div className="p-3">
        <div className="text-sm text-zinc-500">Searching...</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="p-3">
        <div className="text-sm text-zinc-500">No messages found</div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="px-3 py-2 text-xs text-zinc-500 font-medium">
        Search Results ({results.length})
      </div>
      {results.map((message) => (
        <button
          key={message._id}
          onClick={() => handleResultClick(message)}
          className="w-full p-3 flex items-center gap-3 hover:bg-base-300 transition-colors text-left"
        >
          <MessageCircle className="size-8 text-zinc-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {message.senderId.fullName || message.senderId}
            </div>
            <div className="text-xs text-zinc-400 truncate">
              {message.text}
            </div>
            <div className="text-xs text-zinc-500">
              {new Date(message.createdAt).toLocaleDateString()}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default SearchResults;
