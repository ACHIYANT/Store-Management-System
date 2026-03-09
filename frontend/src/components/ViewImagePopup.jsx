import { useEffect, useRef } from "react";
import { toStoreApiUrl } from "@/lib/api-config";
export default function ViewImagePopup({ imagePath, onClose }) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = cleanPath.replace(".enc", "");
    link.click();
  };
  const openedRef = useRef(false); // prevents double open

  //   const cleanPath = imagePath.replace(/^\/uploads\//, "");
  const cleanPath = imagePath.replace(/^\/uploads\//, "");

  const fileUrl = toStoreApiUrl(
    `/view-image?path=${encodeURIComponent(cleanPath)}`,
  );
  const isPdf = cleanPath.toLowerCase().endsWith(".pdf.enc");

  // ✅ Hook ALWAYS runs
  useEffect(() => {
    if (!imagePath) return;

    if (isPdf && !openedRef.current) {
      openedRef.current = true;
      window.open(fileUrl, "_blank", "noopener,noreferrer");
      onClose(); // close popup immediately
    }
  }, [imagePath, isPdf, fileUrl, onClose]);

  if (!imagePath || isPdf) return null; // popup not needed for pdf
  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex justify-center items-center"
      onClick={onClose}
    >
      <div
        className="bg-white p-4 rounded shadow-lg max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 🔧 Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
          <span className="text-sm font-semibold text-gray-700">
            Image Preview
          </span>

          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="px-2 py-1 text-sm bg-gray-200 rounded"
            >
              ⬇
            </button>
          </div>
        </div>
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-2 border-b">
          <span className="text-sm font-semibold text-gray-700">Preview</span>
          <button className="text-red-500 hover:text-red-700" onClick={onClose}>
            ✖
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gray-100">
          <img
            src={fileUrl}
            alt="Preview"
            className="max-w-full max-h-full mx-auto my-auto"
          />
        </div>
      </div>
    </div>
  );
}
