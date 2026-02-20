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

}))
