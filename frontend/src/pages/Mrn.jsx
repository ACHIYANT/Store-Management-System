import React, { useCallback, useState, useEffect } from "react";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ViewImagePopup from "@/components/ViewImagePopUp";
import { useRef } from "react";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";

const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

export default function Mrn() {
  const [selectedRows, setSelectedRows] = useState(null);
  const [viewUrl, setViewUrl] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    finYear: "",
    status: "",
    entryType: "",
  });
  const filterRef = useRef(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isBackdropClosing, setIsBackdropClosing] = useState(false);

  const [isFiltering, setIsFiltering] = useState(false);

  const navigate = useNavigate();
  function handleViewImage(url) {
    if (!url) return alert("No image available.");
    setViewUrl(url); // <-- Show in popup instead of opening in new tab
    console.log("url", url);
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        showFilters &&
        filterRef.current &&
        !filterRef.current.contains(event.target)
      ) {
        closeFilterPanel();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters]);

  const fetchMrnPage = useCallback(
    async ({ cursor, limit }) => {
      setIsFiltering(true);
      try {
        const response = await axios.get(
          "http://localhost:3000/api/v1/mrn/filter",
          {
            params: {
              search: debouncedSearchTerm || undefined,
              finYear: filters.finYear || undefined,
              status: filters.status || undefined,
              entryType: filters.entryType || undefined,
              limit,
              cursorMode: true,
              cursor: cursor || undefined,
            },
          },
        );
        return {
          rows: response?.data?.data || [],
          meta: response?.data?.meta || {},
        };
      } finally {
        setIsFiltering(false);
      }
    },
    [debouncedSearchTerm, filters],
  );

  const {
    rows: data,
    loading,
    isFetchingMore,
    hasMore,
    loadMore,
    virtualStartIndex,
  } = useCursorWindowedList({
    fetchPage: fetchMrnPage,
    deps: [debouncedSearchTerm, filters],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const columns = [
    { key: "id", label: "ID" },
    { key: "entry_no", label: "DayBook Entry No.", sortable: true },
    {
      key: "entry_type",
      label: "DayBook Entry Type",
      sortable: true,
      chip: true,
      chipMap: {
        "Consumable Items": { color: "blue", emoji: "🧾" },
        "Vehicle Items": { color: "yellow", emoji: "🚗" },
        "Fixed Assets": { color: "purple", emoji: "💻" },
        "Stationary Items": { color: "green", emoji: "🖊" },
      },
    },
    // {
    //   key: "gst_no",
    //   label: "GST Number",
    //   render: (val) => <span className="text-blue-600">{val}</span>,
    // },
    { key: "bill_no", label: "Invoice No." },
    { key: "bill_date", label: "Bill Date", sortable: true },
    { key: "total_amount", label: "Bill Amount", sortable: true },
    {
      key: "bill_image_url",
      label: "Bill Image",
      render: (val) => (
        <button
          className="text-blue-600 underline hover:text-blue-800"
          onClick={() => handleViewImage(val)}
        >
          View
        </button>
      ),
    },
    {
      key: "item_image_url",
      label: "Item Image",
      render: (val) => (
        <button
          className="text-blue-600 underline hover:text-blue-800"
          onClick={() => handleViewImage(val)}
        >
          View
        </button>
      ),
    },
    { key: "fin_year", label: "Financial Year" },
    {
      key: "status",
      label: "Status",
      chip: true,
      chipMap: {
        Approved: { color: "green", emoji: "✅" },
        Rejected: { color: "red", emoji: "❌" },
        Pending: { color: "yellow", emoji: "⚠️" },
        "MRN Cancelled": { color: "red-dark", emoji: "⛔️" },
      },
    },
    {
      key: "approval_level",
      label: "Approval Level",
      sortable: true,
      progress: {
        max: 3, // 🟡 dotted progress bar
        colorMap: {
          0: "gray",
          1: "yellow",
          2: "indigo",
          3: "green",
          // 4: "green",
        },
      },
    },
    { key: "remarks", label: "Remarks" },
  ];

  const filterPermissions = {
    finYear: true,
    status: false,
    entryType: true, // enable later if needed
  };
  function FilterPanel({
    permissions,
    filters,
    onChange,
    onReset,
    onClose,
    isClosing,
  }) {
    return (
      <div
        className={`absolute right-0 mt-3 w-80 bg-white rounded-xl border border-gray-200 z-50
  ${isClosing ? "animate-filter-out" : "animate-filter-in"}`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Filters</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Financial Year */}
          {permissions.finYear && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Financial Year
              </label>
              <select
                value={filters.finYear}
                onChange={(e) => onChange("finYear", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="2023-24">2023-24</option>
                <option value="2024-25">2024-25</option>
                <option value="2025-26">2025-26</option>
              </select>
            </div>
          )}

          {/* Status */}
          {permissions.status && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => onChange("status", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          )}

          {/* Entry Type */}
          {permissions.entryType && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Entry Type
              </label>
              <select
                value={filters.entryType}
                onChange={(e) => onChange("entryType", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All</option>
                <option value="Fixed Assets">Fixed Assets</option>
                <option value="Consumable Items">Consumable Items</option>
                <option value="Vehicle Items">Vehicle Items</option>
                <option value="Stationary Items">Stationary Items</option>
              </select>
            </div>
          )}
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
    );
  }
  function closeFilterPanel() {
    setIsClosing(true);
    setIsBackdropClosing(true);

    setTimeout(() => {
      setShowFilters(false);
      setIsClosing(false);
      setIsBackdropClosing(false);
    }, 160); // match your CSS animation time
  }

  function handleAdd() {
    navigate("/day-book-entry");
  }
  function handleRowClick(daybookId) {
    navigate(`/mrn-page/${daybookId}`);
  }
  function handleUpdate() {
    const selectedVendor = data.find((vendor) => vendor.id === selectedRows);

    console.log("Selected vendor 0", selectedVendor);
    // If a valid employee is selected, navigate to the update page with that employee's data
    if (selectedVendor) {
      navigate("/vendor-update", { state: { selectedVendor } });
    } else {
      alert("Please select a valid vendor");
    }
  }
  return (
    <>
      {isFiltering && (
        <div className="fixed top-4 right-4 z-50 bg-white shadow-md rounded px-3 py-1 text-sm text-gray-700">
          Filtering...
        </div>
      )}
      <ListPage
        title="Material Receiving Note"
        columns={columns}
        data={data}
        onAdd={handleAdd}
        apiUrl="http://localhost:3000/api/v1/daybook-with-approval-3"
        searchParam="name"
        idCol="id"
        searchPlaceholder={"Search by DayBook Entry No."}
        aboveContent={
          <div className="relative mb-4">
            {/* Filter Dropdown */}
            {showFilters && (
              <>
                {/* 🌫 Backdrop */}
                <div
                  className={`fixed inset-0 bg-black/10 backdrop-blur-sm z-40
            ${isBackdropClosing ? "backdrop-blur-exit" : "backdrop-blur-animate"}
          `}
                  onClick={closeFilterPanel}
                />

                {/* 🎛 Filter Panel */}
                <div ref={filterRef} className="absolute z-50 right-0">
                  <FilterPanel
                    permissions={filterPermissions}
                    filters={filters}
                    onChange={(key, value) => {
                      setFilters((prev) => ({ ...prev, [key]: value }));
                      // closeFilterPanel();
                    }}
                    onReset={() => {
                      setFilters({
                        finYear: "",
                        status: "",
                        entryType: "",
                      });
                      closeFilterPanel();
                    }}
                    onClose={closeFilterPanel}
                    isClosing={isClosing}
                  />
                </div>
              </>
            )}
          </div>
        }
        onUpdate={handleUpdate} // Pass handleUpdate to the ListPage
        selectedRows={selectedRows} // Pass selectedRows to ListPage
        setSelectedRows={setSelectedRows}
        onRowClick={handleRowClick}
        // showFilter={false}
        onSearch={(term) => setSearchTerm(term)}
        searchValue={searchTerm}
        onFilter={() => setShowFilters(true)}
        showAdd={false}
        showUpdate={false}
        loading={loading}
        table={
          <ListTable
            columns={columns}
            data={data}
            idCol="id"
            selectedRows={selectedRows}
            onRowSelect={(id) =>
              setSelectedRows((prev) => (prev === id ? null : id))
            }
            onRowClick={handleRowClick}
            onLoadMore={loadMore}
            hasMore={hasMore}
            loading={isFetchingMore}
            virtualStartIndex={virtualStartIndex}
          />
        }
      />
      {viewUrl && (
        <ViewImagePopup imagePath={viewUrl} onClose={() => setViewUrl(null)} />
      )}
    </>
  );
}
