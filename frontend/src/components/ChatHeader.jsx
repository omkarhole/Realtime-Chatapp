import { useChatStore } from "../store/useChatStore"
import { useAuthStore } from "../store/useAuthStore"
import { X, Download } from "lucide-react";
import { formatLastSeen } from "../lib/utils";

const ChatHeader = () => {

    const { selectedUser, setSelectedUser, exportChatHistory } = useChatStore();
    const { onlineUsers } = useAuthStore();
    return (
        <div className="p-2.5 border-b border-base-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* avatar */}
                    <div className="avatar">
                        <div className="size-10 rounded-full relative">
                            <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
                        </div>
                    </div>
                    {/* user info */}
                    <div>
                        <h3 className="font-medium">{selectedUser.fullName}</h3>
                        <p className="text-sm text-base-content/70">
                            {onlineUsers.includes(selectedUser._id) ? "Online" : formatLastSeen(selectedUser.lastSeen)}
                        </p>
                    </div>
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                    {/* Export button */}
                    <button 
                        onClick={exportChatHistory} 
                        className="btn btn-ghost btn-sm btn-circle"
                        title="Export chat history"
                    >
                        <Download size={18} />
                    </button>
                    {/* Close button */}
                    <button onClick={() => setSelectedUser(null)} className="btn btn-ghost btn-sm btn-circle">
                        <X />
                    </button>
                </div>

            </div>
        </div>
    )
}

export default ChatHeader
