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
    replyingTo: null,

    // Group-related state
    groups: [],
    selectedGroup: null,
    isGroupsLoading: false,
    groupTypingUsers: [],
    isGroupModalOpen: false,

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
            const messageWithStatus = { ...newMessage, status: 'delivered' };
            set({messages:[...get().messages,messageWithStatus]});
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

    markMessagesAsRead: async (senderId) => {
        const { selectedUser } = get();
        if (!selectedUser) return;
        
        try {
            await axiosInstance.put(`/messages/mark-read/${senderId}`);
            const socket = useAuthStore.getState().socket;
            if (socket) {
                socket.emit("markAsRead", { to: senderId });
            }
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

    clearSearch: () => set({ searchResults: [], isSearchOpen: false }),
    toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),

    exportChatHistory: async () => {
        try {
            toast.loading("Exporting chat history...");
            const res = await axiosInstance.get("/messages/all");
            const allMessages = res.data;
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

    addReaction: async (messageId, emoji) => {
        const { selectedUser, messages } = get();
        if (!selectedUser) return;

        try {
            const res = await axiosInstance.post(`/messages/${messageId}/reactions`, { emoji });
            const updatedMessages = messages.map(msg => 
                msg._id === messageId ? res.data : msg
            );
            set({ messages: updatedMessages });
            const socket = useAuthStore.getState().socket;
            if (socket) {
                socket.emit("addReaction", { to: selectedUser._id, messageId, emoji });
            }
        }
        catch (err) {
            console.log("Error adding reaction:", err);
            toast.error("Failed to add reaction");
        }
    },

    removeReaction: async (messageId, emoji) => {
        const { selectedUser, messages } = get();
        if (!selectedUser) return;

        try {
            const res = await axiosInstance.delete(`/messages/${messageId}/reactions`, { data: { emoji } });
            const updatedMessages = messages.map(msg => 
                msg._id === messageId ? res.data : msg
            );
            set({ messages: updatedMessages });
            const socket = useAuthStore.getState().socket;
            if (socket) {
                socket.emit("removeReaction", { to: selectedUser._id, messageId, emoji });
            }
        }
        catch (err) {
            console.log("Error removing reaction:", err);
            toast.error("Failed to remove reaction");
        }
    },

    subscribeToReactions: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.on("reactionAdded", ({ messageId, reaction }) => {
            const { messages } = get();
            const updatedMessages = messages.map(msg => {
                if (msg._id === messageId) {
                    const existingReaction = msg.reactions?.find(
                        r => r.userId === reaction.userId && r.emoji === reaction.emoji
                    );
                    if (!existingReaction) {
                        return { ...msg, reactions: [...(msg.reactions || []), reaction] };
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

    unSubscribeFromReactions: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("reactionAdded");
        socket.off("reactionRemoved");
    },

    deleteMessage: async (messageId) => {
        const { messages } = get();
        
        try {
            const res = await axiosInstance.delete(`/messages/${messageId}`);
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

    subscribeToDeletedMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.on("messageDeleted", ({ messageId, deletedFor }) => {
            const { messages } = get();
            const updatedMessages = messages.map(msg => {
                if (msg._id === messageId) {
                    return { ...msg, deletedFor: deletedFor };
                }
                return msg;
            });
            set({ messages: updatedMessages });
        });
    },

    unSubscribeFromDeletedMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("messageDeleted");
    },

    // ==================== GROUP ACTIONS ====================
    
    toggleGroupModal: () => set((state) => ({ isGroupModalOpen: !state.isGroupModalOpen })),
    
    setSelectedGroup: (group) => set({ selectedGroup: group }),
    
    getGroups: async () => {
        set({ isGroupsLoading: true });
        try {
            const res = await axiosInstance.get("/groups");
            set({ groups: res.data });
        }
        catch (err) {
            console.log("Error fetching groups:", err);
            toast.error("Failed to load groups");
        }
        finally {
            set({ isGroupsLoading: false });
        }
    },
    
    createGroup: async (groupData) => {
        try {
            const res = await axiosInstance.post("/groups", groupData);
            set((state) => ({ groups: [...state.groups, res.data] }));
            toast.success("Group created successfully");
            return res.data;
        }
        catch (err) {
            console.log("Error creating group:", err);
            toast.error(err.response?.data?.message || "Failed to create group");
            throw err;
        }
    },
    
    getGroupMessages: async (groupId) => {
        try {
            set({ isMessagesLoading: true });
            const res = await axiosInstance.get(`/groups/${groupId}/messages`);
            set({ messages: res.data });
        }
        catch (err) {
            console.log("Error fetching group messages:", err);
            toast.error("Failed to load group messages");
        }
        finally {
            set({ isMessagesLoading: false });
        }
    },
    
    sendGroupMessage: async (messageData) => {
        const { selectedGroup, messages, replyingTo, clearReplyingTo } = get();
        if (!selectedGroup) return;
        
        try {
            const res = await axiosInstance.post(`/groups/${selectedGroup._id}/messages`, messageData);
            set({ messages: [...messages, res.data] });
            if (replyingTo) {
                clearReplyingTo();
            }
            toast.success("Message sent");
            return res.data;
        }
        catch (err) {
            console.log("Error sending group message:", err);
            toast.error("Failed to send message");
            throw err;
        }
    },
    
    subscribeToGroupMessages: () => {
        const { selectedGroup } = get();
        if (!selectedGroup) return;

        const socket = useAuthStore.getState().socket;

        socket.on("newGroupMessage", (newMessage) => {
            if (newMessage.groupId === selectedGroup._id) {
                set({ messages: [...get().messages, newMessage] });
            }
        });

        socket.on("groupUpdated", (updatedGroup) => {
            set((state) => ({
                groups: state.groups.map(g => g._id === updatedGroup._id ? updatedGroup : g),
                selectedGroup: state.selectedGroup?._id === updatedGroup._id ? updatedGroup : state.selectedGroup
            }));
        });

        socket.on("groupMemberAdded", ({ group }) => {
            set((state) => ({
                groups: state.groups.some(g => g._id === group._id)
                    ? state.groups.map(g => g._id === group._id ? group : g)
                    : [...state.groups, group]
            }));
            if (get().selectedGroup?._id === group._id) {
                set({ selectedGroup: group });
            }
            toast.success(`You were added to ${group.name}`);
        });

        socket.on("groupMemberRemoved", ({ groupId }) => {
            const { selectedGroup } = get();
            if (selectedGroup?._id === groupId) {
                set({ selectedGroup: null, messages: [] });
                toast.error("You were removed from the group");
            }
        });

        socket.on("groupMemberLeft", ({ groupId, userId }) => {
            set((state) => ({
                groups: state.groups.map(g => {
                    if (g._id === groupId) {
                        return { ...g, members: g.members.filter(m => m._id !== userId) };
                    }
                    return g;
                })
            }));
        });

        socket.on("groupDeleted", ({ groupId }) => {
            set((state) => ({
                groups: state.groups.filter(g => g._id !== groupId),
                selectedGroup: state.selectedGroup?._id === groupId ? null : state.selectedGroup,
                messages: state.selectedGroup?._id === groupId ? [] : state.messages
            }));
            toast.error("A group was deleted");
        });
    },
    
    unSubscribeFromGroupMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("newGroupMessage");
        socket.off("groupUpdated");
        socket.off("groupMemberAdded");
        socket.off("groupMemberRemoved");
        socket.off("groupMemberLeft");
        socket.off("groupDeleted");
    },
    
    subscribeToGroupTyping: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.on("groupTyping", ({ groupId, from }) => {
            const { selectedGroup, groupTypingUsers } = get();
            if (selectedGroup?._id === groupId && !groupTypingUsers.includes(from)) {
                set({ groupTypingUsers: [...groupTypingUsers, from] });
            }
        });

        socket.on("groupStopTyping", ({ groupId, from }) => {
            const { groupTypingUsers } = get();
            if (get().selectedGroup?._id === groupId) {
                set({ groupTypingUsers: groupTypingUsers.filter(userId => userId !== from) });
            }
        });
    },

    unSubscribeFromGroupTyping: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("groupTyping");
        socket.off("groupStopTyping");
    },

    isGroupTyping: (userId) => {
        return get().groupTypingUsers.includes(userId);
    },

    emitGroupTyping: () => {
        const { selectedGroup } = get();
        if (!selectedGroup) return;
        const socket = useAuthStore.getState().socket;
        if (socket) {
            const members = selectedGroup.members.map(m => m._id || m);
            socket.emit("groupTyping", { groupId: selectedGroup._id, members });
        }
    },

    emitGroupStopTyping: () => {
        const { selectedGroup } = get();
        if (!selectedGroup) return;
        const socket = useAuthStore.getState().socket;
        if (socket) {
            const members = selectedGroup.members.map(m => m._id || m);
            socket.emit("groupStopTyping", { groupId: selectedGroup._id, members });
        }
    },

    addGroupMember: async (groupId, userId) => {
        try {
            const res = await axiosInstance.post(`/groups/${groupId}/members`, { userId });
            set((state) => ({
                groups: state.groups.map(g => g._id === groupId ? res.data : g),
                selectedGroup: state.selectedGroup?._id === groupId ? res.data : state.selectedGroup
            }));
            toast.success("Member added successfully");
            return res.data;
        }
        catch (err) {
            console.log("Error adding member:", err);
            toast.error(err.response?.data?.message || "Failed to add member");
            throw err;
        }
    },

    removeGroupMember: async (groupId, userId) => {
        try {
            const res = await axiosInstance.delete(`/groups/${groupId}/members/${userId}`);
            set((state) => ({
                groups: state.groups.map(g => g._id === groupId ? res.data : g),
                selectedGroup: state.selectedGroup?._id === groupId ? res.data : state.selectedGroup
            }));
            toast.success("Member removed successfully");
            return res.data;
        }
        catch (err) {
            console.log("Error removing member:", err);
            toast.error(err.response?.data?.message || "Failed to remove member");
            throw err;
        }
    },

    leaveGroup: async (groupId) => {
        try {
            await axiosInstance.post(`/groups/${groupId}/leave`);
            set((state) => ({
                groups: state.groups.filter(g => g._id !== groupId),
                selectedGroup: state.selectedGroup?._id === groupId ? null : state.selectedGroup,
                messages: state.selectedGroup?._id === groupId ? [] : state.messages
            }));
            toast.success("Left group successfully");
        }
        catch (err) {
            console.log("Error leaving group:", err);
            toast.error(err.response?.data?.message || "Failed to leave group");
        }
    }
}));
