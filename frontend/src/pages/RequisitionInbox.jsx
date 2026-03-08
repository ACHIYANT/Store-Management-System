import { useCallback, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ListPage from "@/components/ListPage";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";

const API = "http://localhost:3000/api/v1";
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

export default function RequisitionInbox() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const fetchRows = useCallback(
    async ({ cursor, limit }) => {
      const res = await axios.get(`${API}/requisitions`, {
        params: {
          scope: "inbox",
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
    {
      key: "status",
      label: "Status",
      chip: true,
      chipMap: STATUS_CHIP_MAP,
    },
    { key: "requester_name", label: "Requester" },
    { key: "requester_emp_id", label: "Emp ID" },
    { key: "requester_division", label: "Division" },
    {
      key: "current_stage_order",
      label: "Stage",
      render: (_value, row) =>
        row?.current_stage_role
          ? `${row.current_stage_role} (L${row.current_stage_order ?? "-"})`
          : "-",
    },
    {
      key: "item_count",
      label: "Items",
      render: (_value, row) => row?.totals?.item_count ?? 0,
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
      title="Requisition History"
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="Search requisitions worked by you"
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
