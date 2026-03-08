import { useCallback, useState } from "react";
import axios from "axios";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:3000/api/v1";
const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

const STATUS_CHIPS = {
  Disposed: { color: "gray", emoji: "🗑️" },
  Lost: { color: "red", emoji: "❌" },
};

export default function DisposeList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Disposed");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [serverTotal, setServerTotal] = useState(0);

  const fetchPage = useCallback(
    async ({ cursor, limit }) => {
      const res = await axios.get(`${API}/assets/search`, {
        params: {
          status,
          search: debouncedSearch || undefined,
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

  const { rows, loading, isFetchingMore, hasMore, loadMore, virtualStartIndex } =
    useCursorWindowedList({
      fetchPage,
      deps: [debouncedSearch, status],
      pageSize: PAGE_SIZE,
      maxBufferRows: MAX_BUFFER_ROWS,
      trimBatch: TRIM_BATCH,
    });

  const columns = [
    { key: "id", label: "Asset ID" },
    {
      key: "daybook_id",
      label: "DayBook Entry",
      render: (_, row) => row.DayBook?.entry_no || "-",
    },
    {
      key: "item_category_id",
      label: "Category",
      render: (_, row) => row.ItemCategory?.category_name || "-",
    },
    { key: "asset_tag", label: "Asset Tag" },
    { key: "serial_number", label: "Serial Number" },
    { key: "status", label: "Status", chip: true, chipMap: STATUS_CHIPS },
    {
      key: "vendor_id",
      label: "Vendor",
      render: (_, row) => row.Vendor?.name || "-",
    },
    {
      key: "custodian_name",
      label: "Last Custodian",
      render: (_, row) =>
        row.Employee?.name
          ? `${row.Employee.emp_id || "-"} | ${row.Employee.name}`
          : "Store / N.A.",
    },
    {
      key: "notes",
      label: "Notes",
      render: (value) => value || "-",
    },
  ];

  return (
    <ListPage
      title="Dispose List"
      data={rows}
      loading={loading}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="Search by asset tag, serial, category, employee..."
      showAdd={false}
      showUpdate={false}
      showFilter={false}
      aboveContent={
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-600">
            Total Results: <b>{serverTotal || rows.length}</b>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Status</label>
            <select
              className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Disposed">Disposed</option>
              <option value="Lost">Lost</option>
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
            navigate(`/asset/${id}/timeline`);
          }}
        />
      }
    />
  );
}
