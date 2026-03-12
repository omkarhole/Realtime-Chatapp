import { useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { X, Shield, Trash2 } from "lucide-react";

const PrivacySettingsPage = () => {
  const { blockedUsers, isBlockedUsersLoading, getBlockedUsers, unblockUser } = useChatStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBlockedUsers = async () => {
      setIsLoading(true);
      await getBlockedUsers();
      setIsLoading(false);
    };
    loadBlockedUsers();
  }, [getBlockedUsers]);

  const handleUnblock = async (userId) => {
    await unblockUser(userId);
    await getBlockedUsers();
  };

  return (
    <div className="min-h-screen bg-base-100">
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-3xl font-bold text-base-content">Privacy Settings</h1>
          </div>
          <p className="text-base-content/70">Manage your blocked users and privacy preferences</p>
        </div>

        {/* Blocked Users Section */}
        <div className="card bg-base-200 shadow-lg">
          <div className="card-body">
            <h2 className="card-title text-xl mb-4">Blocked Users</h2>

            {isLoading || isBlockedUsersLoading ? (
              <div className="flex justify-center items-center py-8">
                <span className="loading loading-spinner loading-lg text-primary"></span>
              </div>
            ) : blockedUsers && blockedUsers.length > 0 ? (
              <div className="space-y-3">
                {blockedUsers.map((user) => (
                  <div
                    key={user._id}
                    className="flex items-center justify-between p-4 bg-base-100 rounded-lg hover:bg-base-100/80 transition"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {user.profilePic && (
                        <div className="avatar">
                          <div className="w-10 rounded-full">
                            <img
                              src={user.profilePic}
                              alt={user.fullName}
                              className="object-cover"
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-base-content">{user.fullName}</p>
                        <p className="text-sm text-base-content/70">@{user.username}</p>
                        <p className="text-xs text-base-content/50">{user.email}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleUnblock(user._id)}
                      className="btn btn-sm btn-ghost text-error hover:bg-error/10"
                      title="Unblock user"
                    >
                      <Trash2 className="w-4 h-4" />
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Shield className="w-12 h-12 mx-auto mb-3 text-base-content/30" />
                <p className="text-base-content/70">No blocked users</p>
                <p className="text-sm text-base-content/50">You haven't blocked anyone yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Privacy Information */}
        <div className="mt-8 card bg-base-200 shadow-lg">
          <div className="card-body">
            <h2 className="card-title text-lg mb-4">How Blocking Works</h2>
            <ul className="space-y-3 text-base-content/90">
              <li className="flex gap-3">
                <span className="text-primary font-bold">•</span>
                <span>Blocked users cannot send you messages</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">•</span>
                <span>You won't see blocked users in your chat list</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">•</span>
                <span>Blocked users won't know they're blocked</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-bold">•</span>
                <span>You can unblock users anytime from this page</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacySettingsPage;
