import { useEffect, useState } from "react";
import { Users, Search, X } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./SidebarSkeleton";
import { formatLastSeen } from "../lib/utils";

const Sidebar = () => {
  const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading } = useChatStore();
  const { onlineUsers } = useAuthStore();

  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("chats"); // "chats" or "groups"

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const query = searchQuery.trim();
      getUsers(query, { search: Boolean(query) });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [getUsers, searchQuery]);

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  if (isUsersLoading) {
    return <SidebarSkeleton />;
  }

  return (
    <aside
      className={`h-full border-r border-base-300 flex flex-col transition-all duration-200 ${
        selectedUser ? "hidden md:flex" : "flex"
      } w-full md:w-80 lg:w-96`}
    >
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center gap-2">
          <Users className="size-6" />
          <span className="font-medium">Contacts</span>
        </div>

        <div className="mt-3 relative">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search username or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-sm input-bordered w-full bg-base-200"
            />
            {searchQuery && (
              <button onClick={handleClearSearch} className="absolute right-2">
                <X className="size-4 text-zinc-400" />
              </button>
            )}
          </div>
          <button
            onClick={toggleGroupModal}
            className="btn btn-circle btn-sm btn-ghost"
            title="Create Group"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="mt-3 hidden md:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({Math.max(0, onlineUsers.length - 1)} online)</span>
        </div>

        {/* Search Input - Only show for chats */}
        {activeTab === "chats" && (
          <>
            <div className="mt-3 relative">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="input input-sm input-bordered w-full bg-base-200"
                />
                {searchQuery && (
                  <button onClick={handleClearSearch} className="absolute right-2">
                    <X className="size-4 text-zinc-400" />
                  </button>
                )}
              </div>
            </div>

            {/* online filter toggle */}
            <div className="mt-3 hidden lg:flex items-center gap-2">
              <label className="cursor-pointer flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showOnlineOnly}
                  onChange={(e) => setShowOnlineOnly(e.target.checked)}
                  className="checkbox checkbox-sm"
                />
                <span className="text-sm">Show online only</span>
              </label>
              <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
            </div>
          </>
        )}
      </div>

      <div className="overflow-y-auto w-full py-3">
        {filteredUsers.map((user) => (
          <button
            key={user._id}
            onClick={() => {
              setSelectedUser(user);
              if (searchQuery.trim()) setSearchQuery("");
            }}
            className={`
             w-full p-3 flex items-center gap-3
              hover:bg-base-300 transition-colors
              ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
            `}
          >
            <div className="relative mx-auto md:mx-0">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.fullName}
                className="size-12 object-cover rounded-full"
              />
              {onlineUsers.includes(user._id) && (
                <span
                  className="absolute bottom-0 right-0 size-3 bg-green-500 
                  rounded-full ring-2 ring-zinc-900"
                />
              )}
            </div>

            <div className="text-left min-w-0">
              <div className="font-medium truncate">{user.fullName}</div>
              <div className="text-xs text-zinc-500 truncate">
                @{user.username || user.email?.split("@")[0]}
              </div>
              <div className="text-sm text-zinc-400">
                {onlineUsers.includes(user._id) ? "Online" : formatLastSeen(user.lastSeen)}
              </div>
            </div>
          </button>
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center text-zinc-500 py-4">
            {searchQuery ? "No users found" : "No users available yet"}
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
