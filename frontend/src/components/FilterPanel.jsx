import React from "react";
import { useRef } from "react";

export default function FilterPanel({
  title = "Filters",
  fields = [],
  filters,
  onChange,
  onReset,
  onClose,
  isClosing,
}) {
  const panelRef = useRef(null);
  return (
    <>
     
      <div
        className={`fixed inset-0 bg-black/10 backdrop-blur-sm z-40
  ${isClosing ? "backdrop-blur-exit" : "backdrop-blur-animate"}`}
        onClick={onClose}
      />

      {/* 🎛 FILTER PANEL */}
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={`absolute right-0 mt-3 w-80 bg-white rounded-xl border border-gray-200 z-50
  ${isClosing ? "animate-filter-out" : "animate-filter-in"}`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {Array.isArray(fields) &&
            fields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {field.label}
                </label>

                {field.type === "text" && (
                  <input
                    type="text"
                    value={filters[field.key] || ""}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm
                focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                )}

                {field.type === "select" && (
                  <select
                    value={filters[field.key] || ""}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm
                focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">All</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === "date" && (
                  <input
                    type="date"
                    value={filters[field.key] || ""}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                )}
              </div>
            ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex justify-between items-center bg-gray-50 rounded-b-xl">
          <button
            onClick={onReset}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Reset
          </button>

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
