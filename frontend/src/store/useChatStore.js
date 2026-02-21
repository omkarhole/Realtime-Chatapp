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
        const{selectedUser,messages}=get();
        try {
            const res=await axiosInstance.post(`/messages/send/${selectedUser._id}`,messageData);
            set({messages:[...messages,res.data]});
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

}))
