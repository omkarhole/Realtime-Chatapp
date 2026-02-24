import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore"
import SidebarSkeleton from "./SidebarSkeleton";
import { Users, Search, X, Plus, MessageSquare, User } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import SearchResults from "./SearchResults";
import { formatLastSeen } from "../lib/utils";

const Sidebar = () => {
  const { 
    getUsers, 
    users, 
    selectedUser, 
    setSelectedUser, 
    isUserLoading, 
    searchMessages, 
    searchResults, 
    isSearchLoading, 
    clearSearch, 
    isSearchOpen,
    groups,
    getGroups,
    isGroupsLoading,
    selectedGroup,
    setSelectedGroup,
    toggleGroupModal
  } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("chats"); // "chats" or "groups"

  useEffect(() => {
    getUsers();
    getGroups();
  }, [getUsers, getGroups])

  const filteredUsers = showOnlineOnly ? users.filter((user) => onlineUsers.includes(user._id)) : users;

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim()) {
      searchMessages(query);
    } else {
      clearSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    clearSearch();
  };

  const handleSelectUser = (user) => {
    setSelectedGroup(null);
    setSelectedUser(user);
  };

  const handleSelectGroup = (group) => {
    setSelectedUser(null);
    setSelectedGroup(group);
  };

  if (isUserLoading || isGroupsLoading) {
    return <SidebarSkeleton />
  }

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeTab === "chats" ? <Users className="size-6" /> : <MessageSquare className="size-6" />}
            <span className="font-medium hidden lg:block">
              {activeTab === "chats" ? "Chats" : "Groups"}
            </span>
          </div>
          <button
            onClick={toggleGroupModal}
            className="btn btn-circle btn-sm btn-ghost"
            title="Create Group"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 mt-3">
          <button
            onClick={() => setActiveTab("chats")}
            className={`flex-1 btn btn-sm ${activeTab === "chats" ? "btn-primary" : "btn-ghost"}`}
          >
            <User size={16} className="lg:mr-1" />
            <span className="hidden lg:inline">Chats</span>
          </button>
          <button
            onClick={() => setActiveTab("groups")}
            className={`flex-1 btn btn-sm ${activeTab === "groups" ? "btn-primary" : "btn-ghost"}`}
          >
            <MessageSquare size={16} className="lg:mr-1" />
            <span className="hidden lg:inline">Groups</span>
          </button>
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
      
      {/* Search Results Panel */}
      {isSearchOpen && activeTab === "chats" && (
        <div className="border-b border-base-300 max-h-64 overflow-y-auto">
          <SearchResults 
            results={searchResults} 
            isLoading={isSearchLoading} 
            onClose={handleClearSearch}
          />
        </div>
      )}
      
      <div className="overflow-y-auto w-full py-3">
        {/* Chats Tab */}
        {activeTab === "chats" && (
          <>
            {filteredUsers.map((user) => (
              <button
                key={user._id}
                onClick={() => handleSelectUser(user)}
                className={`
                w-full p-3 flex items-center gap-3
                hover:bg-base-300 transition-colors
                ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
              `}
              >
                <div className="relative mx-auto lg:mx-0">
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt={user.name}
                    className="size-12 object-cover rounded-full"
                  />
                  {onlineUsers.includes(user._id) && (
                    <span
                      className="absolute bottom-0 right-0 size-3 bg-green-500 
                      rounded-full ring-2 ring-zinc-900"
                    />
                  )}

                  {/* User info - only visible on larger screens */}
                  <div className="hidden lg:block text-left min-w-0">
                    <div className="font-medium truncate">{user.fullName}</div>
                    <div className="text-sm text-zinc-400">
                      {onlineUsers.includes(user._id) ? "Online" : formatLastSeen(user.lastSeen)}
                    </div>
                  </div>
                </div>

              </button>
            ))}
            
            {filteredUsers.length === 0 && (
              <div className="text-center text-zinc-500 py-4">No online users</div>
            )}
          </>
        )}

        {/* Groups Tab */}
        {activeTab === "groups" && (
          <>
            {groups.map((group) => (
              <button
                key={group._id}
                onClick={() => handleSelectGroup(group)}
                className={`
                w-full p-3 flex items-center gap-3
                hover:bg-base-300 transition-colors
                ${selectedGroup?._id === group._id ? "bg-base-300 ring-1 ring-base-300" : ""}
              `}
              >
                <div className="relative mx-auto lg:mx-0 flex-shrink-0">
                  <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                    {group.avatar ? (
                      <img
                        src={group.avatar}
                        alt={group.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <MessageSquare className="size-6 text-primary" />
                    )}
                  </div>
                  {/* Group member count indicator */}
                  <span className="absolute -bottom-1 -right-1 bg-primary text-primary-content text-xs rounded-full size-4 flex items-center justify-center">
                    {group.members?.length || 0}
                  </span>

                  {/* Group info - only visible on larger screens */}
                  <div className="hidden lg:block text-left min-w-0 flex-1">
                    <div className="font-medium truncate">{group.name}</div>
                    <div className="text-sm text-zinc-400 truncate">
                      {group.lastMessage?.text || `${group.members?.length || 0} members`}
                    </div>
                  </div>
                </div>

              </button>
            ))}
            
            {groups.length === 0 && (
              <div className="text-center text-zinc-500 py-4">
                <p>No groups yet</p>
                <button 
                  onClick={toggleGroupModal}
                  className="btn btn-sm btn-link text-primary"
                >
                  Create a group
                </button>
              </div>
            )}
          </>
        )}
      </div>

    </aside>
  )
}

export default Sidebar
