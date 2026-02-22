import React from 'react';
import { X, Reply } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const ReplyPreview = ({ message, onCancel }) => {
  const { authUser } = useAuthStore();

  if (!message) return null;

  // Get the sender name - handle both populated and unpopulated cases
  const getSenderName = () => {
    if (message.senderId === authUser._id) {
      return 'You';
    }
    // If senderId is populated (has fullName property)
    if (message.senderId && message.senderId.fullName) {
      return message.senderId.fullName;
    }
    // If senderId is just an ID string
    return 'User';
  };

  // Get the preview text - truncate if too long
  const getPreviewText = () => {
    if (message.image) {
      return '📷 Photo';
    }
    if (message.pdf) {
      return '📄 Document';
    }
    if (message.text) {
      return message.text.length > 50 
        ? message.text.substring(0, 50) + '...' 
        : message.text;
    }
    return 'Message';
  };

  return (
    <div className="flex items-start gap-2 p-2 bg-base-200 rounded-lg border border-l-4 border-l-primary mb-2">
      <Reply size={16} className="text-primary mt-1 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-primary font-medium">
          Replying to {getSenderName()}
        </p>
        <p className="text-sm text-zinc-400 truncate">
          {getPreviewText()}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="btn btn-ghost btn-xs btn-circle text-zinc-400 hover:text-zinc-200"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default ReplyPreview;
