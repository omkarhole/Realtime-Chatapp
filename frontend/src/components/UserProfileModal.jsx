import { useState } from "react";
import { X, MessageSquare, Shield, Flag, UserCheck, UserMinus } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import ReportModal from "./ReportModal";
import toast from "react-hot-toast";

const UserProfileModal = ({ isOpen, onClose, user, onStartChat }) => {
  const { blockUser, unblockUser, getBlockedUsers, blockedUsers, reportUser } = useChatStore();
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(blockedUsers.some(u => u._id === user?._id));
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !user) return null;

  const handleBlockToggle = async () => {
    setIsLoading(true);
    try {
      if (isBlocked) {
        await unblockUser(user._id);
        setIsBlocked(false);
      } else {
        await blockUser(user._id);
        setIsBlocked(true);
      }
    } catch (error) {
      console.error("Error toggling block:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-base-100 rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-base-300 sticky top-0 bg-base-100">
            <h2 className="text-lg font-semibold">User Profile</h2>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-xs"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Profile Picture and Name */}
            <div className="text-center">
              {user.profilePic && (
                <div className="flex justify-center mb-4">
                  <img
                    src={user.profilePic}
                    alt={user.fullName}
                    className="w-24 h-24 rounded-full object-cover border-4 border-primary"
                  />
                </div>
              )}
              <h3 className="text-2xl font-bold text-base-content">{user.fullName}</h3>
              <p className="text-base-content/70">@{user.username}</p>
              <p className="text-sm text-base-content/50">{user.email}</p>
            </div>

            {/* User Info */}
            <div className="bg-base-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-base-content/70">Status</span>
                <span className={`badge ${user.isOnline ? "badge-success" : "badge-ghost"}`}>
                  {user.isOnline ? "Online" : "Offline"}
                </span>
              </div>
              {user.lastSeen && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-base-content/70">Last Seen</span>
                  <span className="text-base-content/50">
                    {new Date(user.lastSeen).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {/* Start Chat Button */}
              <button
                onClick={() => {
                  onStartChat(user._id);
                  onClose();
                }}
                className="btn btn-primary w-full gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Send Message
              </button>

              {/* Block Button */}
              <button
                onClick={handleBlockToggle}
                disabled={isLoading}
                className={`btn w-full gap-2 ${
                  isBlocked
                    ? "btn-warning text-base-100"
                    : "btn-error text-base-100"
                }`}
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    {isBlocked ? "Unblocking..." : "Blocking..."}
                  </>
                ) : (
                  <>
                    {isBlocked ? (
                      <>
                        <UserCheck className="w-4 h-4" />
                        Unblock User
                      </>
                    ) : (
                      <>
                        <UserMinus className="w-4 h-4" />
                        Block User
                      </>
                    )}
                  </>
                )}
              </button>

              {/* Report Button */}
              <button
                onClick={() => setReportModalOpen(true)}
                className="btn btn-outline btn-error w-full gap-2"
              >
                <Flag className="w-4 h-4" />
                Report User
              </button>
            </div>

            {/* Block Status */}
            {isBlocked && (
              <div className="bg-error/10 border border-error/20 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-error" />
                  <span className="text-sm text-error">You have blocked this user</span>
                </div>
              </div>
            )}

            {/* Info */}
            <div className="bg-base-200 rounded-lg p-4">
              <p className="text-xs text-base-content/70">
                ℹ️ <strong>About Blocking:</strong> This user won't be able to send you messages or see you in their contacts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        user={user}
      />
    </>
  );
};

export default UserProfileModal;
