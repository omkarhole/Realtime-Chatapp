import React, { useEffect } from 'react'
import { useChatStore } from '../store/useChatStore';
import ChatHeader from './ChatHeader';
import MessageInput from './MessageInput';
import MessageSkeleton from './MessageSkeleton';
import { useAuthStore } from '../store/useAuthStore';
import { formatMessageTime } from '../lib/utils';
import { useRef } from 'react';

const ChatContainer = () => {

  const { messages, getMessages, isMessageLoading, selectedUser, subscribeToMessages, unSubscribeFromMessages, subscribeToTyping, unSubscribeFromTyping, isTyping } = useChatStore();
  const { authUser } = useAuthStore();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    getMessages(selectedUser._id);
    subscribeToMessages();
    subscribeToTyping();
    return()=>{
      unSubscribeFromMessages();
      unSubscribeFromTyping();
    }
  }, [selectedUser._id, getMessages,subscribeToMessages,unSubscribeFromMessages,subscribeToTyping,unSubscribeFromTyping]);

  useEffect(()=>{
    if(messagesEndRef.current && messages){
      messagesEndRef.current?.scrollIntoView({behavior:"smooth"});
    }
  },[messages])

  const isUserTyping = selectedUser && isTyping(selectedUser._id);

  if (isMessageLoading) {
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
            <div className='chat-header mb-1'>
              <time className='text-xs opacity-50 ml-1'>
                {formatMessageTime(message.createdAt)}
              </time>
            </div>
            <div className="chat-bubble flex flex-col ">
              {message.image &&(
                <img src={message.image} alt="message attachment" className="sm:max-w-[200px] rounded-md mb-2" />
              )}
              {message.text && <p>{message.text}</p>}
            </div>
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
