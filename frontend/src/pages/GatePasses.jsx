import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { STORE_API_BASE_URL } from "@/lib/api-config";

const API = STORE_API_BASE_URL;
const PAGE_SIZE = 50;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

const STATUS_CHIPS = {
  Open: { color: "yellow", emoji: "🟡" },
  OutVerified: { color: "blue", emoji: "🔵" },
  InVerified: { color: "green", emoji: "🟢" },
};

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function fmtPurpose(value) {
  if (!value) return "-";
  if (value === "RepairOut") return "Repair Out";
  if (value === "EWasteOut") return "E-Waste Out";
  return value;
}

export default function GatePasses() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  const [status, setStatus] = useState("");
  const [serverTotal, setServerTotal] = useState(0);

  const fetchGatePassesPage = useCallback(
    async ({ cursor, limit }) => {
      const res = await axios.get(`${API}/gate-passes`, {
        params: {
          search: debouncedSearch || undefined,
          status: status || undefined,
          limit,
          cursorMode: true,
          cursor: cursor || undefined,
        },
      });
      const meta = res?.data?.meta || {};
      if (typeof meta.total === "number") {
        setServerTotal(meta.total);
      }
      return {
        rows: res?.data?.data || [],
        meta,
      };
    },
    [debouncedSearch, status],
  );

  const {
    rows,
    loading,
    isFetchingMore,
    hasMore,
    loadMore,
    virtualStartIndex,
  } = useCursorWindowedList({
    fetchPage: fetchGatePassesPage,
    deps: [debouncedSearch, status],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const columns = [
    { key: "id", label: "ID" },
    { key: "pass_no", label: "Pass No" },
    {
      key: "status",
      label: "Status",
      chip: true,
      chipMap: STATUS_CHIPS,
    },
    {
      key: "purpose",
      label: "Purpose",
      render: (v) => fmtPurpose(v),
    },
    {
      key: "issued_at",
      label: "Issued At",
      render: (v) => fmtDate(v),
    },
    {
      key: "totals",
      label: "Items",
      render: (_, row) => row?.totals?.total_items ?? 0,
    },
    {
      key: "out_verified",
      label: "Out Verified",
      render: (_, row) => row?.totals?.out_verified ?? 0,
    },
    {
      key: "in_verified",
      label: "In Verified",
      render: (_, row) => row?.totals?.in_verified ?? 0,
    },
    { key: "created_by", label: "Created By" },
    {
      key: "notes",
      label: "Notes",
      render: (v) => v || "-",
    },
  ];

  return (
    <ListPage
      title="Gate Passes"
      data={rows}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="Search pass no / code / creator / notes..."
      showAdd={false}
      showUpdate={false}
      showFilter={false}
      aboveContent={
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            Total Gate Passes: <b>{serverTotal || rows.length}</b>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Status</label>
            <select
              className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="Open">Open</option>
              <option value="OutVerified">OutVerified</option>
              <option value="InVerified">InVerified</option>
            </select>
          </div>
        </div>
      }
      table={
        <ListTable
          data={rows}
          columns={columns}
          idCol="id"
          loading={isFetchingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
          virtualStartIndex={virtualStartIndex}
          onRowClick={(id) => {
            if (!id) return;
            navigate(`/gate-pass/${id}`);
          }}
        />
      }
      loading={loading}
    />
  );
}
