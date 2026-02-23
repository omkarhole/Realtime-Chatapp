import { create } from "zustand"
import { toast } from "react-hot-toast";
import { axiosInstance } from "../lib/axios"
import {useAuthStore} from "./useAuthStore"

export const useChatStore = create((set,get) => ({
    messages: [],
    users: [],
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    typingUsers: [],
    searchResults: [],
    isSearchLoading: false,
    isSearchOpen: false,
    replyingTo: null, // State to track the message being replied to

    // Set the message to reply to
    setReplyingTo: (message) => set({ replyingTo: message }),

    // Clear the reply state
    clearReplyingTo: () => set({ replyingTo: null }),

    getUsers: async () => {
        set({ isUsersLoading: true });
        try {
            const res = await axiosInstance.get("/messages/users");
            set({ users: res.data.filterUsers });
        }
        catch (err) {
            console.log("error in getting users", err);
            toast.error("Failed to load users");

        }
        finally {
            set({ isUsersLoading: false });
        }
    },
    getMessages: async (userId) => {
        try {
            set({ isMessagesLoading: true })
            const res = await axiosInstance.get(`/messages/${userId}`);
            set({ messages: res.data });
        }
        catch (err) {
            console.log("error in getting messages", err);
            toast.error("Failed to load messages");
        }
        finally {
            set({ isMessagesLoading: false })
        }
    },
    sendMessage: async (messageData) => {
        const{selectedUser,messages, replyingTo, clearReplyingTo}=get();
        try {
            const res=await axiosInstance.post(`/messages/send/${selectedUser._id}`,messageData);
            set({messages:[...messages,res.data]});
            // Clear the replyingTo state after sending
            if (replyingTo) {
                clearReplyingTo();
            }
           toast.success("message send sucessfully ");
        }
        catch (err) {
            console.log("error in sending message", err);
            toast.error("Failed to send message");
        }

    },
    subscribeToMessages:()=>{
        const{selectedUser} =get();
        if(!selectedUser) return;

        const socket=useAuthStore.getState().socket;

        
        socket.on("newMessage",(newMessage)=>{
            const isMessageSendFromSelectedUser=newMessage.senderId===selectedUser._id
        if (!isMessageSendFromSelectedUser) return;
            // Mark as delivered when message is received
            const messageWithStatus = { ...newMessage, status: 'delivered' };
            set({messages:[...get().messages,messageWithStatus]});
            
            // Automatically mark as read since user is viewing the chat
            get().markMessagesAsRead(selectedUser._id);
        });
    },
    unSubscribeFromMessages:()=>{
        const socket=useAuthStore.getState().socket;
        socket.off("newMessage");
    },
    
    setSelectedUser: (selectedUser) => set({ selectedUser }),

    subscribeToTyping: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.on("typing", ({ from }) => {
            const { typingUsers } = get();
            if (!typingUsers.includes(from)) {
                set({ typingUsers: [...typingUsers, from] });
            }
        });

        socket.on("stopTyping", ({ from }) => {
            const { typingUsers } = get();
            set({ typingUsers: typingUsers.filter(userId => userId !== from) });
        });
    },

    unSubscribeFromTyping: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("typing");
        socket.off("stopTyping");
    },

    isTyping: (userId) => {
        return get().typingUsers.includes(userId);
    },

    // Mark messages as read
    markMessagesAsRead: async (senderId) => {
        const { selectedUser } = get();
        if (!selectedUser) return;
        
        try {
            await axiosInstance.put(`/messages/mark-read/${senderId}`);
            
            // Emit socket event to notify the sender
            const socket = useAuthStore.getState().socket;
            if (socket) {
                socket.emit("markAsRead", { to: senderId });
            }
            
            // Update local message status
            const updatedMessages = get().messages.map(msg => 
                msg.senderId === senderId ? { ...msg, status: 'read' } : msg
            );
            set({ messages: updatedMessages });
        }
        catch (err) {
            console.log("Error marking messages as read:", err);
        }
    },

    subscribeToReadReceipts: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.on("messageRead", ({ from }) => {
            // Update messages from the selected user to read status
            const updatedMessages = get().messages.map(msg => 
                msg.senderId === from ? { ...msg, status: 'read' } : msg
            );
            set({ messages: updatedMessages });
        });
    },

    unSubscribeFromReadReceipts: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("messageRead");
    },

    // Search messages
    searchMessages: async (query) => {
        if (!query || query.trim() === "") {
            set({ searchResults: [], isSearchOpen: false });
            return;
        }
        
        try {
            set({ isSearchLoading: true, isSearchOpen: true });
            const res = await axiosInstance.get(`/messages/search?q=${encodeURIComponent(query)}`);
            set({ searchResults: res.data });
        }
        catch (err) {
            console.log("Error searching messages:", err);
            toast.error("Failed to search messages");
        }
        finally {
            set({ isSearchLoading: false });
        }
    },

    // Clear search results
    clearSearch: () => set({ searchResults: [], isSearchOpen: false }),

    // Toggle search panel
    toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),

    // Export chat history as JSON file
    exportChatHistory: async () => {
        try {
            toast.loading("Exporting chat history...");
            const res = await axiosInstance.get("/messages/all");
            const allMessages = res.data;

            // Format the data for export
            const exportData = {
                exportDate: new Date().toISOString(),
                totalMessages: allMessages.length,
                messages: allMessages.map(msg => ({
                    _id: msg._id,
                    senderId: msg.senderId?._id || msg.senderId,
                    senderName: msg.senderId?.fullName || 'Unknown',
                    receiverId: msg.receiverId?._id || msg.receiverId,
                    receiverName: msg.receiverId?.fullName || 'Unknown',
                    text: msg.text || '',
                    image: msg.image || null,
                    status: msg.status,
                    reactions: msg.reactions || [],
                    createdAt: msg.createdAt,
                    updatedAt: msg.updatedAt
                }))
            };

            // Create and download JSON file
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `chat-history-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.dismiss();
            toast.success(`Exported ${allMessages.length} messages successfully!`);
        }
        catch (err) {
            console.log("Error exporting chat history:", err);
            toast.dismiss();
            toast.error("Failed to export chat history");
        }
    },

    // Add reaction to a message
    addReaction: async (messageId, emoji) => {
        const { selectedUser, messages } = get();
        if (!selectedUser) return;

        try {
            const res = await axiosInstance.post(`/messages/${messageId}/reactions`, { emoji });
            
            // Update local messages state
            const updatedMessages = messages.map(msg => 
                msg._id === messageId ? res.data : msg
            );
            set({ messages: updatedMessages });

            // Emit socket event
            const socket = useAuthStore.getState().socket;
            if (socket) {
                socket.emit("addReaction", { 
                    to: selectedUser._id, 
                    messageId, 
                    emoji 
                });
            }
        }
        catch (err) {
            console.log("Error adding reaction:", err);
            toast.error("Failed to add reaction");
        }
    },

    // Remove reaction from a message
    removeReaction: async (messageId, emoji) => {
        const { selectedUser, messages } = get();
        if (!selectedUser) return;

        try {
            const res = await axiosInstance.delete(`/messages/${messageId}/reactions`, {
                data: { emoji }
            });
            
            // Update local messages state
            const updatedMessages = messages.map(msg => 
                msg._id === messageId ? res.data : msg
            );
            set({ messages: updatedMessages });

            // Emit socket event
            const socket = useAuthStore.getState().socket;
            if (socket) {
                socket.emit("removeReaction", { 
                    to: selectedUser._id, 
                    messageId, 
                    emoji 
                });
            }
        }
        catch (err) {
            console.log("Error removing reaction:", err);
            toast.error("Failed to remove reaction");
        }
    },

    // Subscribe to reaction events
    subscribeToReactions: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.on("reactionAdded", ({ messageId, reaction }) => {
            const { messages } = get();
            const updatedMessages = messages.map(msg => {
                if (msg._id === messageId) {
                    // Check if reaction already exists
                    const existingReaction = msg.reactions?.find(
                        r => r.userId === reaction.userId && r.emoji === reaction.emoji
                    );
                    if (!existingReaction) {
                        return {
                            ...msg,
                            reactions: [...(msg.reactions || []), reaction]
                        };
                    }
                }
                return msg;
            });
            set({ messages: updatedMessages });
        });

        socket.on("reactionRemoved", ({ messageId, reaction }) => {
            const { messages } = get();
            const updatedMessages = messages.map(msg => {
                if (msg._id === messageId) {
                    return {
                        ...msg,
                        reactions: (msg.reactions || []).filter(
                            r => !(r.userId === reaction.userId && r.emoji === reaction.emoji)
                        )
                    };
                }
                return msg;
            });
            set({ messages: updatedMessages });
        });
    },

    // Unsubscribe from reaction events
    unSubscribeFromReactions: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("reactionAdded");
        socket.off("reactionRemoved");
    },

    // Delete message for everyone
    deleteMessage: async (messageId) => {
        const { messages } = get();
        
        try {
            const res = await axiosInstance.delete(`/messages/${messageId}`);
            
            // Update local messages state with deletedFor array
            const updatedMessages = messages.map(msg => 
                msg._id === messageId ? { ...msg, deletedFor: res.data.deletedFor } : msg
            );
            set({ messages: updatedMessages });
            
            toast.success("Message deleted for everyone");
        }
        catch (err) {
            console.log("Error deleting message:", err);
            const errorMessage = err.response?.data?.message || "Failed to delete message";
            toast.error(errorMessage);
        }
    },

    // Subscribe to message deletion events
    subscribeToDeletedMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.on("messageDeleted", ({ messageId, deletedFor }) => {
            const { messages } = get();
            const updatedMessages = messages.map(msg => {
                if (msg._id === messageId) {
                    return {
                        ...msg,
                        deletedFor: deletedFor
                    };
                }
                return msg;
            });
            set({ messages: updatedMessages });
        });
    },

    // Unsubscribe from message deletion events
    unSubscribeFromDeletedMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("messageDeleted");
    },

}))
