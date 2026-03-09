import { useCallback, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ListPage from "@/components/ListPage";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { STORE_API_BASE_URL } from "@/lib/api-config";

const API = STORE_API_BASE_URL;
const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;
const STATUS_CHIP_MAP = {
  Draft: { color: "gray", emoji: "📝" },
  Submitted: { color: "yellow", emoji: "📨" },
  InReview: { color: "blue", emoji: "🔎" },
  Approved: { color: "green", emoji: "✅" },
  PartiallyApproved: { color: "indigo", emoji: "🧩" },
  Rejected: { color: "red", emoji: "❌" },
  Cancelled: { color: "gray", emoji: "🚫" },
  Fulfilling: { color: "blue", emoji: "📦" },
  Fulfilled: { color: "green", emoji: "🏁" },
};

export default function RequisitionStoreQueue() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const fetchRows = useCallback(
    async ({ cursor, limit }) => {
      const res = await axios.get(`${API}/requisitions`, {
        params: {
          scope: "store",
          cursorMode: true,
          cursor: cursor || undefined,
          limit,
          search: debouncedSearch || undefined,
        },
      });
      return {
        rows: res.data?.data || [],
        meta: res.data?.meta || { hasMore: false, nextCursor: null },
      };
    },
    [debouncedSearch],
  );

  const {
    rows,
    loading,
    isFetchingMore,
    hasMore,
    loadMore,
    virtualStartIndex,
  } = useCursorWindowedList({
    fetchPage: fetchRows,
    deps: [debouncedSearch],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const columns = [
    { key: "req_no", label: "Req No." },
    { key: "status", label: "Status", chip: true, chipMap: STATUS_CHIP_MAP },
    {
      key: "pending_at",
      label: "Pending At",
      render: (_value, row) => {
        const status = String(row?.status || "");
        if (
          ["Submitted", "InReview", "PartiallyApproved"].includes(status) &&
          row?.current_stage_role
        ) {
          return `${row.current_stage_role} (L${row.current_stage_order ?? "-"})`;
        }
        if (["Approved", "PartiallyApproved", "Fulfilling"].includes(status)) {
          return "STORE_ENTRY";
        }
        return row?.current_stage_role || "-";
      },
    },
    { key: "requester_name", label: "Requester" },
    { key: "requester_emp_id", label: "Emp ID" },
    { key: "requester_division", label: "Division" },
    {
      key: "remaining_qty",
      label: "Pending Qty",
      render: (_value, row) => row?.totals?.remaining_qty ?? 0,
    },
    {
      key: "updatedAt",
      label: "Updated",
      render: (value) =>
        value ? new Date(value).toLocaleString("en-IN") : "-",
    },
  ];

  return (
    <ListPage
      title="Requisition Queue"
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="Search requisitions pending at your level"
      showAdd={false}
      showUpdate={false}
      showFilter={false}
      loading={loading}
      data={rows}
      columns={columns}
      onLoadMore={loadMore}
      hasMore={hasMore}
      tableLoading={isFetchingMore}
      virtualStartIndex={virtualStartIndex}
      onRowClick={(id) => navigate(`/requisitions/${id}`)}
    />
  );
}
