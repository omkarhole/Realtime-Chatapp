import { useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { X, Users, Image, Check, Search } from "lucide-react";

const GroupModal = () => {
  const { isGroupModalOpen, toggleGroupModal, createGroup, getGroups, setSelectedGroup } = useChatStore();
  const { users, getUsers } = useAuthStore();
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupAvatar, setGroupAvatar] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isGroupModalOpen) {
      getUsers();
    }
  }, [isGroupModalOpen, getUsers]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
        setGroupAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    if (selectedMembers.length === 0) return;

    setIsCreating(true);
    try {
      const newGroup = await createGroup({
        name: groupName.trim(),
        members: selectedMembers,
        avatar: groupAvatar,
      });
      toggleGroupModal();
      setGroupName("");
      setSelectedMembers([]);
      setGroupAvatar("");
      setAvatarPreview("");
      // Select the newly created group
      setSelectedGroup(newGroup);
      getGroups();
    } catch (error) {
      console.error("Error creating group:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    toggleGroupModal();
    setGroupName("");
    setSelectedMembers([]);
    setGroupAvatar("");
    setAvatarPreview("");
    setSearchQuery("");
  };

  if (!isGroupModalOpen) return null;

  const filteredUsers = users.filter((user) =>
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-base-100 rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300">
          <div className="flex items-center gap-2">
            <Users className="size-5" />
            <h2 className="text-lg font-semibold">Create Group</h2>
          </div>
          <button
            onClick={handleClose}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Group Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="size-24 rounded-full bg-base-300 flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Group Avatar"
                    className="size-full object-cover"
                  />
                ) : (
                  <Users className="size-10 text-zinc-400" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 btn btn-circle btn-sm btn-primary">
                <Image size={16} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Group Name Input */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Group Name *
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name"
              className="input input-bordered w-full"
            />
          </div>

          {/* Members Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Select Members * (at least 1)
            </label>
            
            {/* Search Input */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="input input-sm input-bordered w-full pl-9"
              />
            </div>

            {/* Users List */}
            <div className="max-h-48 overflow-y-auto border border-base-300 rounded-lg">
              {filteredUsers.map((user) => (
                <label
                  key={user._id}
                  className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-base-200 ${
                    selectedMembers.includes(user._id) ? "bg-primary/10" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(user._id)}
                    onChange={() => toggleMember(user._id)}
                    className="checkbox checkbox-sm checkbox-primary"
                  />
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt={user.fullName}
                    className="size-8 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {user.fullName}
                    </p>
                    <p className="text-xs text-zinc-400 truncate">
                      {user.email}
                    </p>
                  </div>
                  {selectedMembers.includes(user._id) && (
                    <Check className="size-4 text-primary" />
                  )}
                </label>
              ))}
              {filteredUsers.length === 0 && (
                <div className="p-4 text-center text-zinc-500 text-sm">
                  No users found
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {selectedMembers.length} member(s) selected
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-base-300 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="btn btn-ghost"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selectedMembers.length === 0 || isCreating}
            className="btn btn-primary"
          >
            {isCreating ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              "Create Group"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupModal;
