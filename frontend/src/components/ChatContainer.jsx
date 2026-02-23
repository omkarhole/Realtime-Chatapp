import React, { useEffect, useState, useRef } from 'react'
import { useChatStore } from '../store/useChatStore';
import ChatHeader from './ChatHeader';
import MessageInput from './MessageInput';
import MessageSkeleton from './MessageSkeleton';
import { useAuthStore } from '../store/useAuthStore';
import { formatMessageTime } from '../lib/utils';
import { FileText, Download, Reply, Play, Pause, Trash2 } from 'lucide-react';
import EmojiPicker from './EmojiPicker';

const ChatContainer = () => {

  const { messages, getMessages, isMessagesLoading, selectedUser, subscribeToMessages, unSubscribeFromMessages, subscribeToTyping, unSubscribeFromTyping, isTyping, markMessagesAsRead, subscribeToReadReceipts, unSubscribeFromReadReceipts, subscribeToReactions, unSubscribeFromReactions, addReaction, removeReaction, setReplyingTo, deleteMessage, subscribeToDeletedMessages, unSubscribeFromDeletedMessages } = useChatStore();
  const { authUser } = useAuthStore();
  const messagesEndRef = useRef(null);
  const [messageReactions, setMessageReactions] = useState({});
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [audioProgress, setAudioProgress] = useState({});
  const audioRefs = useRef({});

  useEffect(() => {
    getMessages(selectedUser._id);
    subscribeToMessages();
    subscribeToTyping();
    subscribeToReadReceipts();
    subscribeToReactions();
    subscribeToDeletedMessages();
    return () => {
      unSubscribeFromMessages();
      unSubscribeFromTyping();
      unSubscribeFromReadReceipts();
      unSubscribeFromReactions();
      unSubscribeFromDeletedMessages();
    };
  }, [selectedUser._id, getMessages, subscribeToMessages, unSubscribeFromMessages, subscribeToTyping, unSubscribeFromTyping, subscribeToReadReceipts, unSubscribeFromReadReceipts, subscribeToReactions, unSubscribeFromReactions, subscribeToDeletedMessages, unSubscribeFromDeletedMessages]);

  // Mark messages as read when user opens chat
  useEffect(() => {
    if (selectedUser && messages.length > 0) {
      markMessagesAsRead(selectedUser._id);
    }
  }, [messages, selectedUser, markMessagesAsRead]);

  useEffect(() => {
    if (messagesEndRef.current && messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages])

  const isUserTyping = selectedUser && isTyping(selectedUser._id);

  // Audio playback functions
  const toggleAudioPlayback = (messageId, audioUrl) => {
    if (playingAudioId === messageId) {
      // Pause
      if (audioRefs.current[messageId]) {
        audioRefs.current[messageId].pause();
      }
      setPlayingAudioId(null);
    } else {
      // Play
      if (audioRefs.current[messageId]) {
        audioRefs.current[messageId].play();
        setPlayingAudioId(messageId);
      }
    }
  };

  const handleAudioEnded = (messageId) => {
    setPlayingAudioId(null);
    setAudioProgress(prev => ({ ...prev, [messageId]: 0 }));
  };

  const handleAudioTimeUpdate = (messageId, duration) => {
    if (audioRefs.current[messageId]) {
      const currentTime = audioRefs.current[messageId].currentTime;
      const progress = (currentTime / duration) * 100;
      setAudioProgress(prev => ({ ...prev, [messageId]: progress }));
    }
  };

  const formatAudioTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Function to render message status indicator
  const renderMessageStatus = (status) => {
    if (status === 'read') {
      return <span className="text-blue-500 ml-1">✓✓</span>;
    } else if (status === 'delivered') {
      return <span className="text-gray-400 ml-1">✓✓</span>;
    } else {
      return <span className="text-gray-400 ml-1">✓</span>;
    }
  };

  // Helper function to get file name from URL
  const getFileName = (url) => {
    if (!url) return 'Document';
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    return decodeURIComponent(fileName.replace(/\.[^/.]+$/, ''));
  };

  // Handle adding a reaction
  const handleAddReaction = (messageId, emoji) => {
    addReaction(messageId, emoji);
  };

  // Handle removing a reaction
  const handleRemoveReaction = (messageId, emoji) => {
    removeReaction(messageId, emoji);
  };

  // Handle reply to message
  const handleReply = (message) => {
    setReplyingTo(message);
  };

  // Handle delete message
  const handleDeleteMessage = (messageId) => {
    deleteMessage(messageId);
  };

  // Check if message is deleted for the current user
  const isMessageDeleted = (message) => {
    if (!message.deletedFor) return false;
    return message.deletedFor.some(id => id === authUser._id || id === authUser._id.toString());
  };

  // Check if user has reacted with a specific emoji
  const hasUserReacted = (reactions, emoji) => {
    return reactions?.some(r => r.userId === authUser._id && r.emoji === emoji);
  };

  // Group reactions by emoji
  const groupReactions = (reactions) => {
    if (!reactions || reactions.length === 0) return [];
    const grouped = {};
    reactions.forEach(r => {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = [];
      }
      grouped[r.emoji].push(r.userId);
    });
    return Object.entries(grouped).map(([emoji, users]) => ({ emoji, count: users.length, users }));
  };

  // Get the original message that is being replied to
  const getReplyMessage = (replyToId) => {
    return messages.find(m => m._id === replyToId);
  };

  // Render the quoted message preview
  const renderReplyPreview = (replyToId) => {
    const replyMessage = getReplyMessage(replyToId);
    if (!replyMessage) return null;

    const getSenderName = () => {
      if (replyMessage.senderId === authUser._id) return 'You';
      if (replyMessage.senderId && replyMessage.senderId.fullName) {
        return replyMessage.senderId.fullName;
      }
      return 'User';
    };

    const getPreviewText = () => {
      if (replyMessage.audio) return '🎤 Voice Message';
      if (replyMessage.image) return '📷 Photo';
      if (replyMessage.pdf) return '📄 Document';
      if (replyMessage.text) {
        return replyMessage.text.length > 30 
          ? replyMessage.text.substring(0, 30) + '...' 
          : replyMessage.text;
      }
      return 'Message';
    };

    return (
      <div className="flex items-start gap-2 p-2 bg-base-200 rounded-lg border-l-2 border-primary mb-2 cursor-pointer" onClick={() => handleReply(replyMessage)}>
        <Reply size={14} className="text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-primary font-medium">
            {getSenderName()}
          </p>
          <p className="text-xs text-zinc-400 truncate">
            {getPreviewText()}
          </p>
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
    return <div className='flex-1 flex flex-col overflow-auto'>
      <ChatHeader />
      <MessageSkeleton />
      <MessageInput />
    </div>
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message._id}
            className={`chat ${message.senderId === authUser._id ? 'chat-end' : 'chat-start'}`}
            ref={messagesEndRef}
          >
            <div className='chat-image avatar'>
              <div className='size-10 rounded-full border'>
                <img src={message.senderId == authUser._id ? authUser.profilePic || '/avatar.png' :
                  selectedUser.profilePic || "/avatar.png"} alt="profile Pic" />
              </div>
            </div>
            <div className='chat-header mb-1 flex items-center'>
              <time className='text-xs opacity-50 ml-1'>
                {formatMessageTime(message.createdAt)}
              </time>
              {message.senderId === authUser._id && renderMessageStatus(message.status)}
            </div>
            <div className="chat-bubble flex flex-col relative group">
              {/* Reply preview if this message is a reply */}
              {message.replyTo && renderReplyPreview(message.replyTo)}
              
              {message.image && (
                <img src={message.image} alt="message attachment" className="sm:max-w-[200px] rounded-md mb-2" />
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
              {/* Audio player */}
              {message.audio && renderAudioPlayer(message)}
              {message.text && !isMessageDeleted(message) && <p>{message.text}</p>}
              
              {/* Show "This message was deleted" placeholder for deleted messages */}
              {isMessageDeleted(message) && (
                <p className="text-sm text-zinc-400 italic">This message was deleted</p>
              )}
              
              {/* Action buttons - visible on hover - only show if message is not deleted */}
              {!isMessageDeleted(message) && (
                <div className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  {/* Delete button - only visible for sender */}
                  {message.senderId === authUser._id && (
                    <button
                      onClick={() => handleDeleteMessage(message._id)}
                      className="btn btn-circle btn-ghost btn-xs text-zinc-400 hover:text-red-500"
                      title="Delete for everyone"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {/* Reply button */}
                  <button
                    onClick={() => handleReply(message)}
                    className="btn btn-circle btn-ghost btn-xs text-zinc-400 hover:text-primary"
                    title="Reply"
                  >
                    <Reply size={14} />
                  </button>
                  {/* Emoji picker */}
                  <EmojiPicker 
                    onSelect={(emoji) => handleAddReaction(message._id, emoji)} 
                  />
                </div>
              )}
            </div>
            
            {/* Reactions display */}
            {message.reactions && message.reactions.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {groupReactions(message.reactions).map((group, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (hasUserReacted(message.reactions, group.emoji)) {
                        handleRemoveReaction(message._id, group.emoji);
                      } else {
                        handleAddReaction(message._id, group.emoji);
                      }
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                      hasUserReacted(message.reactions, group.emoji)
                        ? 'bg-blue-500/20 border-blue-500'
                        : 'bg-zinc-700/50 border-zinc-600'
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

        {/* Typing Indicator */}
        {isUserTyping && (
          <div className="chat chat-start">
            <div className='chat-image avatar'>
              <div className='size-10 rounded-full border'>
                <img src={selectedUser.profilePic || "/avatar.png"} alt="profile Pic" />
              </div>
            </div>
            <div className="chat-bubble">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
      </div>

      <MessageInput />
    </div>
  )
}

export default ChatContainer
