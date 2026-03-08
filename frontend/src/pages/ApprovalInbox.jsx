import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";

const API = "http://localhost:3000/api/v1";
const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

function resolveApprovalScope() {
  const roles = JSON.parse(localStorage.getItem("roles") || "[]");

  let level = null;
  let isStoreEntry = false;

  if (roles.includes("STORE_ENTRY")) {
    isStoreEntry = true;
  } else if (roles.includes("CLERK_APPROVER") || roles.includes("PROC_APPROVER")) {
    level = 1;
  } else if (
    roles.includes("INSPECTION_OFFICER") ||
    roles.includes("ACCTS_APPROVER")
  ) {
    level = 2;
  } else if (roles.includes("ADMIN_APPROVER")) {
    level = 3;
  } else if (roles.includes("SUPER_APPROVER")) {
    level = 4;
  }

  return { level, isStoreEntry };
}

function normalizeApprovalRow(row) {
  return {
    ...row,
    vendor_display: row.vendor_name || row.vendor_id || "-",
    next_role_display:
      row.next_role ||
      (row.approval_level != null ? `Level ${row.approval_level}` : "-"),
  };
}

export default function ApprovalInbox() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { level, isStoreEntry } = useMemo(() => resolveApprovalScope(), []);

  const fetchRows = useCallback(
    async ({ cursor, limit }) => {
      const params = {
        limit,
        cursorMode: true,
        cursor: cursor || undefined,
        entryNo: debouncedSearch || undefined,
        level: isStoreEntry ? undefined : level,
        isStoreEntry: isStoreEntry || undefined,
      };

      const res = await axios.get(`${API}/daybook`, {
        params,
      });

      const rows = (res.data?.data || []).map(normalizeApprovalRow);
      const meta = res.data?.meta || { hasMore: false, nextCursor: null };

      return { rows, meta };
    },
    [debouncedSearch, isStoreEntry, level],
  );

  const {
    rows,
    loading,
    isFetchingMore,
    hasMore,
    loadMore,
    refresh,
    virtualStartIndex,
  } = useCursorWindowedList({
    fetchPage: fetchRows,
    deps: [debouncedSearch, level, isStoreEntry],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const handleApprove = useCallback(
    async (id) => {
      try {
        await axios.patch(
          `${API}/daybook/${id}/approve`,
          {}
        );
        refresh();
      } catch (error) {
        console.error("Approval failed", error);
        window.alert("Failed to approve this entry.");
      }
    },
    [refresh],
  );

  const handleSendBack = useCallback(
    async (id) => {
      const remarks = window.prompt("Reason to send back?");
      if (remarks === null) return;

      try {
        await axios.patch(
          `${API}/daybook/${id}/reject`,
          { remarks }
        );
        refresh();
      } catch (error) {
        console.error("Send back failed", error);
        window.alert("Failed to send back this entry.");
      }
    },
    [refresh],
  );

  const columns = [
    { key: "entry_no", label: "Entry #" },
    { key: "vendor_display", label: "Vendor" },
    { key: "total_amount", label: "Amount" },
    { key: "next_role_display", label: "Next Role" },
    {
      key: "actions",
      label: "Actions",
      render: (_val, row) => (
        <div className="flex items-center gap-2">
          <button
            className="rounded bg-green-600 px-3 py-1 text-white"
            onClick={(e) => {
              e.stopPropagation();
              handleApprove(row.id);
            }}
          >
            Approve
          </button>
          <button
            className="rounded bg-yellow-600 px-3 py-1 text-white"
            onClick={(e) => {
              e.stopPropagation();
              handleSendBack(row.id);
            }}
          >
            Send Back
          </button>
        </div>
      ),
    },
  ];

  return (
    <ListPage
      title="My Approval Inbox"
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="Search by entry number..."
      data={rows}
      loading={loading}
      showAdd={false}
      showUpdate={false}
      showFilter={false}
      table={
        <ListTable
          data={rows}
          columns={columns}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={isFetchingMore}
          virtualStartIndex={virtualStartIndex}
        />
      }
    />
  );
}
