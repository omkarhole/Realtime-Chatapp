import { useChatStore } from "../store/useChatStore"
import { useAuthStore } from "../store/useAuthStore"
import { X, Download, MessageSquare, Users, ArrowLeft } from "lucide-react";
import { formatLastSeen } from "../lib/utils";

const ChatHeader = () => {

    const { selectedUser, setSelectedUser, selectedGroup, setSelectedGroup, exportChatHistory } = useChatStore();
    const { onlineUsers } = useAuthStore();

    // Check if we're in a group chat
    const isGroup = !!selectedGroup;
    const currentContact = isGroup ? selectedGroup : selectedUser;

    const handleClose = () => {
        if (isGroup) {
            setSelectedGroup(null);
        } else {
            setSelectedUser(null);
        }
    };

    // Get group members for display
    const getGroupSubtitle = () => {
        if (!selectedGroup) return "";
        const memberCount = selectedGroup.members?.length || 0;
        return `${memberCount} members`;
    };

    // Get member names who are online
    const getOnlineMembers = () => {
        if (!selectedGroup || !selectedGroup.members) return [];
        return selectedGroup.members.filter(member => 
            onlineUsers.includes(member._id || member)
        );
    };

    const onlineMembers = getOnlineMembers();

    return (
        <div className="p-2.5 border-b border-base-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Back button for mobile */}
                    <button 
                        onClick={handleClose} 
                        className="btn btn-ghost btn-sm btn-circle lg:hidden"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    
                    {/* avatar */}
                    <div className="avatar">
                        <div className="size-10 rounded-full relative">
                            {isGroup ? (
                                selectedGroup?.avatar ? (
                                    <img src={selectedGroup.avatar} alt={selectedGroup.name} />
                                ) : (
                                    <div className="bg-primary/20 rounded-full flex items-center justify-center">
                                        <MessageSquare className="size-5 text-primary" />
                                    </div>
                                )
                            ) : (
                                <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
                            )}
                        </div>
                    </div>
                    
                    {/* user/group info */}
                    <div>
                        <h3 className="font-medium">
                            {isGroup ? selectedGroup?.name : selectedUser?.fullName}
                        </h3>
                        <p className="text-sm text-base-content/70">
                            {isGroup ? (
                                onlineMembers.length > 0 
                                    ? `${onlineMembers.length} online`
                                    : getGroupSubtitle()
                            ) : (
                                onlineUsers.includes(selectedUser._id) ? "Online" : formatLastSeen(selectedUser.lastSeen)
                            )}
                        </p>
                    </div>
                </div>
                
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                    {/* Group members button */}
                    {isGroup && (
                        <div className="dropdown dropdown-end">
                            <button 
                                tabIndex={0} 
                                className="btn btn-ghost btn-sm btn-circle"
                                title="View members"
                            >
                                <Users size={18} />
                            </button>
                            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow-lg bg-base-100 rounded-box w-52 max-h-64 overflow-y-auto">
                                <li className="menu-title px-2 py-1">
                                    <span>Members ({selectedGroup?.members?.length || 0})</span>
                                </li>
                                {selectedGroup?.members?.map((member) => (
                                    <li key={member._id || member}>
                                        <a className="flex items-center gap-2">
                                            <img 
                                                src={member.profilePic || "/avatar.png"} 
                                                alt={member.fullName}
                                                className="size-8 rounded-full"
                                            />
                                            <div className="flex-1">
                                                <span className="font-medium">{member.fullName}</span>
                                                {member._id === selectedGroup?.admin?._id || member._id === selectedGroup?.admin ? (
                                                    <span className="badge badge-xs badge-primary ml-1">Admin</span>
                                                ) : null}
                                            </div>
                                            {onlineUsers.includes(member._id || member) && (
                                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                            )}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    {/* Export button - only for individual chats */}
                    {!isGroup && (
                        <button 
                            onClick={exportChatHistory} 
                            className="btn btn-ghost btn-sm btn-circle"
                            title="Export chat history"
                        >
                            <Download size={18} />
                        </button>
                    )}
                    
                    {/* Close button */}
                    <button onClick={handleClose} className="btn btn-ghost btn-sm btn-circle">
                        <X />
                    </button>
                </div>

            </div>
        </div>
    )
}

export default ChatHeader
