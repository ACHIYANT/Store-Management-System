import React, { useState, useEffect, useRef, useCallback } from "react";
import ListPage from "@/components/ListPage";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ViewImagePopup from "@/components/ViewImagePopup";
import PopupMessage from "@/components/PopupMessage";
import FilterPanel from "@/components/FilterPanel";
import useDebounce from "@/hooks/useDebounce";
import ListTable from "@/components/ListTable";
import { toStoreApiUrl } from "@/lib/api-config";

// 🟢 Add LegendItem helper (same style as AssetTimeline)
function LegendItem({ color = "gray", label }) {
  const colorMap = {
    green: "bg-green-500",
    pink: "bg-pink-500",
    purple: "bg-purple-500",
    blue: "bg-blue-500",
    yellow: "bg-yellow-400",
    indigo: "bg-indigo-500",
    stone: "bg-stone-500",
    red: "bg-red-500",
    gray: "bg-gray-200",
  };
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-3 h-3 rounded ${colorMap[color] || colorMap.gray}`} />
      <span className="text-xs text-gray-700">{label}</span>
    </div>
  );
}

const DAYBOOK_PAGE_SIZE = 100;
const DAYBOOK_MAX_BUFFER_ROWS = 3000;
const DAYBOOK_TRIM_BATCH = 1000;

export default function DayBook() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [virtualStartIndex, setVirtualStartIndex] = useState(0);
  const [selectedRows, setSelectedRows] = useState(null);
  const [viewUrl, setViewUrl] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [showFilters, setShowFilters] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [sending, setSending] = useState(false);
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
  });

  const [filters, setFilters] = useState({
    finYear: "",
    status: "",
    entryType: "",
  });
  const dataRef = useRef([]);
  const fetchingMoreRef = useRef(false);
  const requestIdRef = useRef(0);
  const virtualStartRef = useRef(0);
  const filterRef = useRef(null);
  const dayBookFilterFields = [
    {
      key: "finYear",
      label: "Financial Year",
      type: "select",
      options: [
        { value: "2023-24", label: "2023-24" },
        { value: "2024-25", label: "2024-25" },
        { value: "2025-26", label: "2025-26" },
      ],
    },
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "Pending", label: "Pending" },
        { value: "Approved", label: "Approved" },
        { value: "Rejected", label: "Rejected" },
      ],
    },
    {
      key: "entryType",
      label: "Entry Type",
      type: "select",
      options: [
        { value: "Fixed Assets", label: "Fixed Assets" },
        { value: "Consumable Items", label: "Consumable Items" },
        { value: "Stationary Items", label: "Stationary Items" },
        { value: "Vehicle Items", label: "Vehicle Items" },
      ],
    },
  ];

  // Read roles once for action buttons (used below)
  const roles = JSON.parse(localStorage.getItem("roles")) || [];
  function handleViewImage(url) {
    if (!url) {
      setPopup({
        open: true,
        type: "info",
        message: "No image available for this record.",
      });
      return;
    }
    console.log("url", url);
    setViewUrl(url); // <-- Show in popup instead of opening in new tab
  }
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    virtualStartRef.current = virtualStartIndex;
  }, [virtualStartIndex]);

  const fetchDayBooks = useCallback(
    async (cursorValue = null, append = false) => {
      if (append && fetchingMoreRef.current) return;
      const requestId = ++requestIdRef.current;

      try {
        if (append) {
          fetchingMoreRef.current = true;
          setIsFetchingMore(true);
        } else {
          fetchingMoreRef.current = false;
          setLoading(true);
          setSelectedRows(null);
        }

        let apiUrl = toStoreApiUrl("/daybook");

        const response = await axios.get(apiUrl, {
          params: {
            entryNo: debouncedSearchTerm || undefined,
            finYear: filters.finYear || undefined,
            status: filters.status || undefined,
            entryType: filters.entryType || undefined,
            limit: DAYBOOK_PAGE_SIZE,
            cursorMode: true,
            cursor: cursorValue || undefined,
          },
        });

        const rows = response?.data?.data || [];
        const meta = response?.data?.meta || {};
        const nextHasMore = Boolean(meta.hasMore);
        const fetchedNextCursor =
          typeof meta.nextCursor === "string" && meta.nextCursor.trim() !== ""
            ? meta.nextCursor
            : null;

        if (requestId !== requestIdRef.current) return;

        if (append) {
          const merged = [...dataRef.current, ...rows];
          let nextData = merged;
          let nextVirtualStart = virtualStartRef.current;

          if (merged.length > DAYBOOK_MAX_BUFFER_ROWS) {
            const trimBy = Math.min(
              DAYBOOK_TRIM_BATCH,
              merged.length - DAYBOOK_MAX_BUFFER_ROWS,
            );
            nextData = merged.slice(trimBy);
            nextVirtualStart += trimBy;
          }

          dataRef.current = nextData;
          virtualStartRef.current = nextVirtualStart;
          setData(nextData);
          setVirtualStartIndex(nextVirtualStart);
        } else {
          dataRef.current = rows;
          virtualStartRef.current = 0;
          setData(rows);
          setVirtualStartIndex(0);
        }
        setHasMore(nextHasMore);
        setNextCursor(fetchedNextCursor);
      } catch (error) {
        console.error("Failed to fetch Day Books:", error);
        if (requestId !== requestIdRef.current) return;
        if (!append) {
          dataRef.current = [];
          virtualStartRef.current = 0;
          setData([]);
          setHasMore(false);
          setNextCursor(null);
          setVirtualStartIndex(0);
        }
      } finally {
        if (append) {
          fetchingMoreRef.current = false;
          setIsFetchingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [debouncedSearchTerm, filters],
  );

  useEffect(() => {
    fetchDayBooks(null, false);
  }, [fetchDayBooks]);

  const handleLoadMore = useCallback(() => {
    if (loading || isFetchingMore || !hasMore || !nextCursor) return;
    fetchDayBooks(nextCursor, true);
  }, [loading, isFetchingMore, hasMore, nextCursor, fetchDayBooks]);

  const handleTableRowSelect = useCallback((id) => {
    setSelectedRows((prev) => (prev === id ? null : id));
  }, []);

  const columns = [
    { key: "id", label: "ID", width: 160 },
    { key: "entry_no", label: "DayBook Entry No.", sortable: true, width: 180 },
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

    { key: "bill_no", label: "Invoice No.", width: 200 },
    { key: "bill_date", label: "Bill Date", sortable: true, width: 180 },
    { key: "total_amount", label: "Bill Amount", sortable: true, width: 180 },
    // { key: "other_charges", label: "Other Charges" },
    {
      key: "bill_image_url",
      label: "Bill Image",
      width: 180,
      render: (val) => (
        <button
          disabled={!val}
          // className="text-blue-600 underline hover:text-blue-800"
          className={`underline ${
            val
              ? "text-blue-600 hover:text-blue-800"
              : "text-gray-400 cursor-not-allowed"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            handleViewImage(val);
          }}
        >
          View
        </button>
      ),
    },
    {
      key: "item_image_url",
      label: "Item Image",
      width: 180,
      render: (val) => (
        <button
          disabled={!val}
          // className="text-blue-600 underline hover:text-blue-800"
          className={`underline ${
            val
              ? "text-blue-600 hover:text-blue-800"
              : "text-gray-400 cursor-not-allowed"
          }`}
          onClick={(e) => {
            e.stopPropagation(); // 🔴 THIS IS THE FIX
            handleViewImage(val);
          }}
        >
          View
        </button>
      ),
    },
    { key: "fin_year", label: "Financial Year", width: 180 },
    {
      key: "status",
      label: "Status",
      // chip: true,
      // chipMap: {
      //   Approved: "green",
      //   Rejected: "red",
      //   Pending: "yellow",
      // },
      chip: true,
      chipMap: {
        Approved: { color: "green", emoji: "✅" },
        Rejected: { color: "red", emoji: "❌" },
        Pending: { color: "yellow", emoji: "⚠️" },
        "MRN Cancelled": { color: "red-dark", emoji: "⛔️" },
      },
      width: 180,
    },
    {
      key: "approval_level",
      label: "Approval Level",
      width: 180,
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

  const navigate = useNavigate();
  // 🔒 Find selected DayBook record
  const selectedDayBook = data.find(
    (dayBook) => String(dayBook.id) === String(selectedRows),
  );

  const roleLevel = roles.includes("STORE_ENTRY")
    ? 0
    : roles.includes("CLERK_APPROVER")
      ? 1
      : roles.includes("INSPECTION_OFFICER")
        ? 2
        : roles.includes("ADMIN_APPROVER")
          ? 3
          : roles.includes("SUPER_APPROVER")
            ? 4
            : null;

  const levelLabel = (lvl) =>
    ({
      0: "Store Entry",
      1: "Clerk Approver",
      2: "Inspection Officer",
      3: "Admin Approver",
      4: "Super Approver",
    })[lvl] || `Level ${lvl}`;

  const normalizeLevel = (lvl) =>
    lvl === null || lvl === undefined || lvl === "" ? 0 : Number(lvl);

  // 🔒 Lock update if MRN exists
  const level = Number(selectedDayBook?.approval_level ?? 0);
  const isApproved = selectedDayBook?.status === "Approved";
  const hasMrn = !!selectedDayBook?.mrn_security_code;

  const canUpdate = !!selectedDayBook && level === 0 && !isApproved && !hasMrn;

  const updateDisabled = !canUpdate;

  const updateTooltip = !selectedDayBook
    ? "Select a DayBook to update"
    : level !== 0
      ? "Only Level 0 entries can be updated"
      : isApproved
        ? "Approved entries cannot be edited"
        : hasMrn
          ? "MRN already generated. Cancel MRN before editing."
          : "";

  function handleAdd() {
    navigate("/day-book-entry");
  }
  function handleRowClick(daybookId) {
    navigate(`/daybook-items-all/${daybookId}`);
  }

  function handleUpdate() {
    if (!selectedRows) {
      setPopup({
        open: true,
        type: "error",
        message: "Please select a DayBook first",
      });
      return;
    }

    // 🔁 Route to full edit flow
    navigate(`/daybook/edit/${selectedRows}`);
  }

  console.log("data", typeof data);

  const closeFilterPanel = () => {
    setIsClosing(true);

    setTimeout(() => {
      setShowFilters(false);
      setIsClosing(false);
    }, 160); // match animation
  };

  return (
    <>
      <ListPage
        title="Day Books"
        aboveContent={
          <div className="relative mb-4">
            <div className="mb-4 mt-4 flex flex-wrap gap-4 items-center">
              <LegendItem color="green" label="Approved" />
              <LegendItem color="red" label="Rejected" />
              <LegendItem color="white" label="Store Entry (0)" />
              <LegendItem color="yellow" label="Clerk Approver (1)" />
              <LegendItem color="indigo" label="Inspection Officer (2)" />
              <LegendItem color="purple" label="Admin Approver (3)" />
              {/* <LegendItem color="stone" label="Super Approver (4)" /> */}
            </div>
            {/* Filter Dropdown */}

            {showFilters && (
              <>
                <div ref={filterRef} className="absolute z-50 right-0">
                  <FilterPanel
                    title="DayBook Filters"
                    fields={dayBookFilterFields}
                    filters={filters}
                    onChange={(key, value) => {
                      setFilters((prev) => ({ ...prev, [key]: value }));
                      // closeFilterPanel();
                    }}
                    onReset={() => {
                      setFilters({ finYear: "", status: "", entryType: "" });
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
        columns={columns}
        data={data}
        onAdd={handleAdd}
        idCol="id"
        onUpdate={handleUpdate}
        updateDisabled={updateDisabled}
        updateTooltip={updateTooltip}
        onFilter={() => {
          if (showFilters) {
            closeFilterPanel();
          } else {
            setShowFilters(true);
          }
        }}
        selectedRows={selectedRows} // Pass selectedRows to ListPage
        setSelectedRows={setSelectedRows}
        onRowClick={handleRowClick}
        onSearch={(term) => setSearchTerm(term)}
        searchValue={searchTerm}
        loading={loading}
        searchPlaceholder="Search by entry no..."
        table={
          <ListTable
            columns={columns}
            data={data}
            idCol="id"
            selectedRows={selectedRows}
            onRowSelect={handleTableRowSelect}
            onRowClick={handleRowClick}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            loading={isFetchingMore}
            virtualStartIndex={virtualStartIndex}
          />
        }
        actions={[
          // ✅ Send forward (available to everyone who can see the list)
          {
            label: "Send for Approval",
            onClick: async () => {
              console.log(selectedRows);
              if (!selectedRows) {
                setPopup({
                  open: true,
                  type: "error",
                  message: "Please select a daybook first",
                });
                return;
              }
              if (!selectedDayBook) {
                setPopup({
                  open: true,
                  type: "error",
                  message: "Selected daybook not found",
                });
                return;
              }
              if (roleLevel === null) {
                setPopup({
                  open: true,
                  type: "error",
                  message: "You are not allowed to send approvals",
                });
                return;
              }

              const rowLevel = normalizeLevel(selectedDayBook.approval_level);
              if (rowLevel !== roleLevel) {
                setPopup({
                  open: true,
                  type: "error",
                  message: `This entry is currently at ${levelLabel(
                    rowLevel,
                  )}. You can only send from ${levelLabel(roleLevel)}.`,
                });
                return;
              }

              if (sending) return;
              setSending(true);
              try {
                await axios.patch(
                  toStoreApiUrl(`/daybook/${selectedRows}/approve`),
                );
                setPopup({
                  open: true,
                  type: "success",
                  message: "Record sent for approval",
                });
                setSelectedRows(null);
                fetchDayBooks(null, false);
              } catch (err) {
                console.error(err);
                setPopup({
                  open: true,
                  type: "error",
                  message: "Error while sending for approval",
                });
              } finally {
                setSending(false);
              }
            },
          },
          // ❌ Reject back to Store (HIDDEN for STORE_ENTRY)
          ...(roles.includes("STORE_ENTRY")
            ? []
            : [
                {
                  label: "Reject to Store",
                  onClick: async () => {
                    if (!selectedRows) {
                      setPopup({
                        open: true,
                        type: "error",
                        message: "Please select a record first",
                      });
                      return;
                    }
                    const remarks =
                      prompt("Optional: add remarks for rejection") || "";
                    try {
                      await axios.patch(
                        toStoreApiUrl(`/daybook/${selectedRows}/reject`),
                        { remarks },
                      );
                      setPopup({
                        open: true,
                        type: "success",
                        message: "Record sent back to Store",
                      });
                      fetchDayBooks(null, false);
                    } catch (err) {
                      console.error(err);
                      setPopup({
                        open: true,
                        type: "error",
                        message: "Error while rejecting",
                      });
                    }
                  },
                },
              ]),
        ]}
      />

      {viewUrl && (
        <ViewImagePopup imagePath={viewUrl} onClose={() => setViewUrl(null)} />
      )}
      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup((p) => ({ ...p, open: false }))}
      />
    </>
  );
}
