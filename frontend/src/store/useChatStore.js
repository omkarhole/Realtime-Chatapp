import { create } from "zustand"
import { toast } from "react-hot-toast";
import { axiosInstance } from "../lib/axios"
import {useAuthStore} from "./useAuthStore"

let refreshUsersTimer = null;

const normalizeId = (value) => {
    if (!value) return "";
    if (typeof value === "object") return String(value._id || value.id || "");
    return String(value);
};

const getErrorMessage = (err, fallbackMessage) =>
    err?.response?.data?.message || err?.message || fallbackMessage;

const upsertMessage = (messages = [], incomingMessage) => {
    if (!incomingMessage) return messages;

    const incomingId = normalizeId(incomingMessage._id);
    if (!incomingId) {
        return [...messages, incomingMessage];
    }

    const existingIndex = messages.findIndex(
        (message) => normalizeId(message._id) === incomingId
    );

    if (existingIndex === -1) {
        return [...messages, incomingMessage];
    }

    const nextMessages = [...messages];
    nextMessages[existingIndex] = {
        ...nextMessages[existingIndex],
        ...incomingMessage,
    };

    return nextMessages;
};

export const useChatStore = create((set,get) => ({
    messages: [],
    users: [],
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    isSendingMessage: false,
    searchResults: [],
    isSearchLoading: false,
    isSearchOpen: false,
    replyingTo: null, // State to track the message being replied to

    // Set the message to reply to
    setReplyingTo: (message) => set({ replyingTo: message }),

    // Clear the reply state
    clearReplyingTo: () => set({ replyingTo: null }),

    refreshUsersSilently: () => {
        if (refreshUsersTimer) {
            clearTimeout(refreshUsersTimer);
        }

        refreshUsersTimer = setTimeout(() => {
            get().getUsers("", { silent: true });
        }, 250);
    },

    getUsers: async (searchQuery = "", options = {}) => {
        const { search = false, silent = false } = options;
        if (!silent) set({ isUsersLoading: true });

        try {
            const query = searchQuery.trim();
            let endpoint = "/messages/users";
            if (search && query) {
                endpoint = `/messages/users?q=${encodeURIComponent(query)}&search=true`;
            }

            const res = await axiosInstance.get(endpoint);
            set({ users: Array.isArray(res.data?.filterUsers) ? res.data.filterUsers : [] });
        }
        catch (err) {
            console.log("error in getting users", err);
            if (!silent) {
                toast.error(getErrorMessage(err, "Failed to load users"));
                set({ users: [] });
            }

        }
        finally {
            if (!silent) set({ isUsersLoading: false });
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
        const{selectedUser, replyingTo, clearReplyingTo}=get();
        if (!selectedUser) {
            toast.error("Select a user first");
            return false;
        }

        if (get().isSendingMessage) {
            return false;
        }

        set({ isSendingMessage: true });
        try {
            const res=await axiosInstance.post(`/messages/send/${selectedUser._id}`,messageData);
            set((state) => ({ messages: upsertMessage(state.messages, res.data) }));
            get().refreshUsersSilently();
            // Clear the replyingTo state after sending
            if (replyingTo) {
                clearReplyingTo();
            }
            return true;
        }
        catch (err) {
            console.log("error in sending message", err);
            toast.error(getErrorMessage(err, "Failed to send message"));
            return false;
        }
        finally {
            set({ isSendingMessage: false });
        }

    },
    subscribeToMessages:()=>{
        const socket=useAuthStore.getState().socket;
        if(!socket) return;

        socket.off("newMessage");
        socket.on("newMessage",(newMessage)=>{
            const selectedUser = get().selectedUser;
            const selectedUserId = normalizeId(selectedUser?._id);
            const authUserId = normalizeId(useAuthStore.getState().authUser?._id);
            const senderId = normalizeId(newMessage.senderId);
            const receiverId = normalizeId(newMessage.receiverId);
            const isCurrentConversation =
                selectedUserId &&
                ((senderId === selectedUserId && receiverId === authUserId) ||
                    (senderId === authUserId && receiverId === selectedUserId));

            get().refreshUsersSilently();
            if (!isCurrentConversation) return;

            const messageWithStatus =
                senderId === authUserId ? newMessage : { ...newMessage, status: "delivered" };
            set((state) => ({ messages: upsertMessage(state.messages, messageWithStatus) }));
        });
    },
    unSubscribeFromMessages:()=>{
        const socket=useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("newMessage");
    },
    
    setSelectedUser: (selectedUser) => set({ selectedUser }),

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
                normalizeId(msg.senderId) === normalizeId(senderId) ? { ...msg, status: 'read' } : msg
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

        socket.off("messageRead");
        socket.on("messageRead", ({ from }) => {
            // Update messages from the selected user to read status
            const updatedMessages = get().messages.map(msg =>
                normalizeId(msg.receiverId) === normalizeId(from) ? { ...msg, status: 'read' } : msg
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

        socket.off("reactionAdded");
        socket.off("reactionRemoved");

        socket.on("reactionAdded", ({ messageId, reaction }) => {
            const { messages } = get();
            const updatedMessages = messages.map(msg => {
                if (msg._id === messageId) {
                    // Check if reaction already exists
                    const existingReaction = msg.reactions?.find(
                        r => normalizeId(r.userId) === normalizeId(reaction.userId) && r.emoji === reaction.emoji
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
                            r => !(normalizeId(r.userId) === normalizeId(reaction.userId) && r.emoji === reaction.emoji)
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

}))
