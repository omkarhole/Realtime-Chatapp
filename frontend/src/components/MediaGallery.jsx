import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Download, FileText, Image as ImageIcon, ZoomIn } from "lucide-react";

const MediaGallery = ({ isOpen, onClose, mediaByDate = [] }) => {
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!isOpen) return null;

  // Flatten all media for lightbox navigation
  const allMedia = mediaByDate.flatMap(group => group.media);

  const handleMediaClick = (media, index) => {
    setSelectedMedia(media);
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    const newIndex = (currentIndex - 1 + allMedia.length) % allMedia.length;
    setCurrentIndex(newIndex);
    setSelectedMedia(allMedia[newIndex]);
  };

  const goToNext = () => {
    const newIndex = (currentIndex + 1) % allMedia.length;
    setCurrentIndex(newIndex);
    setSelectedMedia(allMedia[newIndex]);
  };

  const handleDownload = (url, type) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `media_${Date.now()}.${type === "image" ? "jpg" : "pdf"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      {/* Main Modal */}
      <div className="bg-base-100 rounded-lg w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300">
          <h2 className="text-xl font-bold">Media Gallery</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {allMedia.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <ImageIcon size={48} className="mx-auto mb-4 text-base-content/30" />
                <p className="text-base-content/60">No media found in this conversation</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {mediaByDate.map((group) => (
                <div key={group.date}>
                  <h3 className="text-sm font-semibold text-base-content/70 mb-3 sticky top-0 bg-base-100 py-2">
                    {group.date}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {group.media.map((media, index) => {
                      const globalIndex = allMedia.findIndex(m => m._id === media._id);
                      return (
                        <div
                          key={media._id}
                          className="relative group cursor-pointer rounded-lg overflow-hidden bg-base-200 aspect-square"
                          onClick={() => handleMediaClick(media, globalIndex)}
                        >
                          {media.type === "image" ? (
                            <img
                              src={media.image}
                              alt="Gallery"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-base-300 to-base-200 flex flex-col items-center justify-center">
                              <FileText size={32} className="text-base-content/60 mb-2" />
                              <span className="text-xs text-center text-base-content/60 px-2">PDF</span>
                            </div>
                          )}

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn size={24} className="text-white" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedMedia && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center group"
          onClick={() => setSelectedMedia(null)}
        >
          <div className="relative w-full h-full flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute top-4 right-4 z-10 btn btn-ghost btn-circle"
            >
              <X size={24} className="text-white" />
            </button>

            {/* Media Content */}
            <div className="flex items-center justify-center max-w-4xl max-h-[80vh]">
              {selectedMedia.type === "image" ? (
                <img
                  src={selectedMedia.image}
                  alt="Preview"
                  className="max-w-full max-h-full rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-base-100 p-12 rounded-lg">
                    <FileText size={64} className="text-primary" />
                  </div>
                  <p className="text-white text-lg">PDF Document</p>
                  <a
                    href={selectedMedia.pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary gap-2"
                  >
                    <Download size={18} />
                    Open PDF
                  </a>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            {allMedia.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                  }}
                  className="absolute left-4 btn btn-ghost btn-circle hover:bg-base-100/20"
                >
                  <ChevronLeft size={24} className="text-white" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                  }}
                  className="absolute right-4 btn btn-ghost btn-circle hover:bg-base-100/20"
                >
                  <ChevronRight size={24} className="text-white" />
                </button>
              </>
            )}

            {/* Download Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(
                  selectedMedia.type === "image" ? selectedMedia.image : selectedMedia.pdf,
                  selectedMedia.type
                );
              }}
              className="absolute bottom-4 left-4 btn btn-ghost gap-2"
            >
              <Download size={18} className="text-white" />
              <span className="text-white">Download</span>
            </button>

            {/* Counter */}
            {allMedia.length > 1 && (
              <div className="absolute bottom-4 right-4 bg-base-100/80 px-3 py-1 rounded-full text-sm">
                {currentIndex + 1} / {allMedia.length}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaGallery;
