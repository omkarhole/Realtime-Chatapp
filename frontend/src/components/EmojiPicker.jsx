import React, { useState } from 'react';
import { Smile } from 'lucide-react';

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉', '❤️‍🔥', '👀'];

const EmojiPicker = ({ onSelect, onClose }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleEmojiClick = (emoji) => {
    onSelect(emoji);
    setIsOpen(false);
    if (onClose) onClose();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 hover:bg-zinc-700 rounded-full transition-colors"
        title="Add reaction"
      >
        <Smile size={18} className="text-zinc-400" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-1 left-0 bg-zinc-800 border border-zinc-600 rounded-lg shadow-lg p-2 z-50">
          <div className="flex flex-wrap gap-1 max-w-[150px]">
            {EMOJI_LIST.map((emoji, index) => (
              <button
                key={index}
                onClick={() => handleEmojiClick(emoji)}
                className="w-8 h-8 flex items-center justify-center text-xl hover:bg-zinc-700 rounded transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmojiPicker;
