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
    replyingTo: null,

    // Starred messages state
    starredMessages: [],
    isStarredMessagesLoading: false,

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
    unSubscribeFromMessages:(){
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

        socket.off("reactionAdded");
        socket.off("reactionRemoved");

        socket.on("reactionAdded", ({ messageId, reaction }) => {
            const { messages } = get();
            const updatedMessages = messages.map(msg => {
                if (msg._id === messageId) {
                    const existingReaction = msg.reactions?.find(
                        r => normalizeId(r.userId) === normalizeId(reaction.userId) && r.emoji === reaction.emoji
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
                            r => !(normalizeId(r.userId) === normalizeId(reaction.userId) && r.emoji === reaction.emoji)
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

    // ==================== STARRED MESSAGES ACTIONS ====================
    
    getStarredMessages: async () => {
        set({ isStarredMessagesLoading: true });
        try {
            const res = await axiosInstance.get("/messages/starred");
            set({ starredMessages: res.data });
        }
        catch (err) {
            console.log("Error fetching starred messages:", err);
            toast.error("Failed to load starred messages");
        }
        finally {
            set({ isStarredMessagesLoading: false });
        }
    },

    toggleStarMessage: async (messageId) => {
        const { messages, starredMessages } = get();
        const authUserId = useAuthStore.getState().authUser?._id;

        try {
            const res = await axiosInstance.post(`/messages/${messageId}/star`);
            const { isStarred } = res.data;

            // Update messages in current conversation
            const updatedMessages = messages.map(msg => {
                if (msg._id === messageId) {
                    let starredBy = msg.starredBy || [];
                    if (isStarred) {
                        starredBy = [...starredBy, { _id: authUserId }];
                    } else {
                        starredBy = starredBy.filter(s => normalizeId(s) !== normalizeId(authUserId));
                    }
                    return { ...msg, starredBy };
                }
                return msg;
            });
            set({ messages: updatedMessages });

            // Update starred messages list
            if (isStarred) {
                const starredMessage = messages.find(msg => msg._id === messageId);
                if (starredMessage) {
                    set({ starredMessages: [...starredMessages, { ...starredMessage, starredBy: res.data.starredBy }] });
                }
            } else {
                set({ starredMessages: starredMessages.filter(msg => msg._id !== messageId) });
            }

            toast.success(res.data.message);
            return isStarred;
        }
        catch (err) {
            console.log("Error toggling star:", err);
            toast.error("Failed to toggle star");
            return null;
        }
    },

    isMessageStarred: (messageId) => {
        const { messages, starredMessages } = get();
        const authUserId = normalizeId(useAuthStore.getState().authUser?._id);
        
        // Check in current messages
        const message = messages.find(msg => msg._id === messageId);
        if (message?.starredBy) {
            return message.starredBy.some(s => normalizeId(s) === authUserId);
        }
        
        // Check in starred messages
        const starredMessage = starredMessages.find(msg => msg._id === messageId);
        if (starredMessage?.starredBy) {
            return starredMessage.starredBy.some(s => normalizeId(s) === authUserId);
        }
        
        return false;
    },

    subscribeToStarredMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.off("messageStarred");
        socket.on("messageStarred", ({ messageId, isStarred, userId }) => {
            const authUserId = normalizeId(useAuthStore.getState().authUser?._id);
            
            // Only update if the change is made by another user
            if (normalizeId(userId) === authUserId) return;

            const { messages, starredMessages } = get();

            // Update messages in current conversation
            const updatedMessages = messages.map(msg => {
                if (msg._id === messageId) {
                    let starredBy = msg.starredBy || [];
                    if (isStarred) {
                        starredBy = [...starredBy, { _id: userId }];
                    } else {
                        starredBy = starredBy.filter(s => normalizeId(s) !== normalizeId(userId));
                    }
                    return { ...msg, starredBy };
                }
                return msg;
            });
            set({ messages: updatedMessages });

            // Update starred messages list
            if (isStarred) {
                const starredMessage = messages.find(msg => msg._id === messageId);
                if (starredMessage && !starredMessages.find(m => m._id === messageId)) {
                    set({ starredMessages: [...starredMessages, starredMessage] });
                }
            } else {
                set({ starredMessages: starredMessages.filter(msg => msg._id !== messageId) });
            }
        });
    },

    unSubscribeFromStarredMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (!socket) return;
        socket.off("messageStarred");
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
