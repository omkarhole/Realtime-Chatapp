import React, { useState, useEffect } from "react";
import { X, User, Users, Search, Check } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

const ForwardModal = () => {
  const {
    forwardModalOpen,
    setForwardModalOpen,
    messageToForward,
    setMessageToForward,
    forwardMessage,
    users,
    getUsers,
    groups,
    getGroups,
  } = useChatStore();

  const { authUser } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [activeTab, setActiveTab] = useState("users"); // "users" or "groups"
  const [isForwarding, setIsForwarding] = useState(false);

  useEffect(() => {
    if (forwardModalOpen) {
      getUsers();
      getGroups();
      setSelectedRecipients([]);
      setSearchQuery("");
    }
  }, [forwardModalOpen, getUsers, getGroups]);

  const handleClose = () => {
    setForwardModalOpen(false);
    setMessageToForward(null);
    setSelectedRecipients([]);
    setSearchQuery("");
  };

  const toggleRecipient = (type, id) => {
    const recipient = { type, id };
    const exists = selectedRecipients.some(
      (r) => r.type === type && r.id === id
    );

    if (exists) {
      setSelectedRecipients(
        selectedRecipients.filter((r) => !(r.type === type && r.id === id))
      );
    } else {
      setSelectedRecipients([...selectedRecipients, recipient]);
    }
  };

  const isSelected = (type, id) => {
    return selectedRecipients.some((r) => r.type === type && r.id === id);
  };

  const handleForward = async () => {
    if (!messageToForward || selectedRecipients.length === 0) return;

    setIsForwarding(true);
    try {
      await forwardMessage(messageToForward._id, selectedRecipients);
      handleClose();
    } finally {
      setIsForwarding(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user._id !== authUser._id &&
      (user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredGroups = groups.filter((group) =>
    group.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!forwardModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-base-100 rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-200">
          <h3 className="text-lg font-semibold">Forward Message</h3>
          <button
            onClick={handleClose}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-base-200">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              placeholder="Search users or groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-bordered w-full pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-base-200">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex-1 py-3 flex items-center justify-center gap-2 ${
              activeTab === "users"
                ? "border-b-2 border-primary text-primary"
                : "text-zinc-400"
            }`}
          >
            <User size={18} />
            <span>Users</span>
          </button>
          <button
            onClick={() => setActiveTab("groups")}
            className={`flex-1 py-3 flex items-center justify-center gap-2 ${
              activeTab === "groups"
                ? "border-b-2 border-primary text-primary"
                : "text-zinc-400"
            }`}
          >
            <Users size={18} />
            <span>Groups</span>
          </button>
        </div>

        {/* Recipients List */}
        <div className="flex-1 overflow-y-auto p-2">
          {activeTab === "users" ? (
            filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <div
                  key={user._id}
                  onClick={() => toggleRecipient("user", user._id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-base-200 ${
                    isSelected("user", user._id) ? "bg-primary/10" : ""
                  }`}
                >
                  <div className="avatar">
                    <div className="size-10 rounded-full">
                      <img
                        src={user.profilePic || "/avatar.png"}
                        alt={user.fullName}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{user.fullName}</p>
                    <p className="text-sm text-zinc-400">@{user.username}</p>
                  </div>
                  {isSelected("user", user._id) && (
                    <Check size={20} className="text-primary" />
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-zinc-400">
                No users found
              </div>
            )
          ) : filteredGroups.length > 0 ? (
            filteredGroups.map((group) => (
              <div
                key={group._id}
                onClick={() => toggleRecipient("group", group._id)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-base-200 ${
                  isSelected("group", group._id) ? "bg-primary/10" : ""
                }`}
              >
                <div className="avatar">
                  <div className="size-10 rounded-full">
                    <img src={group.avatar || "/avatar.png"} alt={group.name} />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{group.name}</p>
                  <p className="text-sm text-zinc-400">
                    {group.members?.length || 0} members
                  </p>
                </div>
                {isSelected("group", group._id) && (
                  <Check size={20} className="text-primary" />
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-zinc-400">
              No groups found
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-base-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">
              {selectedRecipients.length} selected
            </span>
            <button
              onClick={handleForward}
              disabled={selectedRecipients.length === 0 || isForwarding}
              className="btn btn-primary"
            >
              {isForwarding ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                "Forward"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
