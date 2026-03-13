import { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";

const ReportModal = ({ isOpen, onClose, user, messageId = null }) => {
  const { reportUser } = useChatStore();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportReasons = [
    { value: "spam", label: "Spam" },
    { value: "hate_speech", label: "Hate Speech" },
    { value: "harassment", label: "Harassment" },
    { value: "misinformation", label: "Misinformation" },
    { value: "explicit_content", label: "Explicit Content" },
    { value: "other", label: "Other" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }

    setIsSubmitting(true);
    try {
      await reportUser(user._id, messageId, reason, description);
      setReason("");
      setDescription("");
      onClose();
    } catch (error) {
      console.error("Error submitting report:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-error" />
            <h2 className="text-lg font-semibold">Report User</h2>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* User Info */}
          <div className="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
            {user.profilePic && (
              <img
                src={user.profilePic}
                alt={user.fullName}
                className="w-10 h-10 rounded-full object-cover"
              />
            )}
            <div>
              <p className="font-semibold text-base-content">{user.fullName}</p>
              <p className="text-sm text-base-content/70">@{user.username}</p>
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-base-content mb-2">
              Report Reason *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="select select-bordered w-full text-base-content bg-base-200"
            >
              <option value="">Select a reason...</option>
              {reportReasons.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-base-content mb-2">
              Additional Details
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide more context for your report (optional)"
              maxLength={500}
              className="textarea textarea-bordered w-full bg-base-200 text-base-content placeholder-base-content/50"
              rows="4"
            />
            <p className="text-xs text-base-content/50 mt-1">
              {description.length}/500 characters
            </p>
          </div>

          {/* Info */}
          <div className="bg-info/10 border border-info/20 rounded-lg p-3">
            <p className="text-sm text-info">
              Your report will be reviewed by our team. We appreciate your help in keeping the community safe.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-error flex-1"
              disabled={isSubmitting || !reason}
            >
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Submitting...
                </>
              ) : (
                "Submit Report"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportModal;
