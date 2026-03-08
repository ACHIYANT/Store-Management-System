import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import FilterPanel from "@/components/FilterPanel";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";

const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

const EVENT_TYPES = [
  "Created",
  "Issued",
  "Returned",
  "Transferred",
  "SubmittedToStore",
  "RepairOut",
  "RepairIn",
  "MarkedEWaste",
  "EWasteOut",
  "Adjusted",
  "Disposed",
  "Lost",
  "Retained",
  "MRN Cancelled",
];

const EVENT_CHIPS = {
  Created: { color: "green", emoji: "🟢" },
  Issued: { color: "blue", emoji: "📤" },
  Returned: { color: "yellow", emoji: "📥" },
  Transferred: { color: "indigo", emoji: "🔁" },
  SubmittedToStore: { color: "purple", emoji: "🏬" },
  RepairOut: { color: "red", emoji: "🛠️" },
  RepairIn: { color: "green", emoji: "✅" },
  MarkedEWaste: { color: "yellow", emoji: "♻️" },
  EWasteOut: { color: "indigo", emoji: "🚛" },
  Adjusted: { color: "gray", emoji: "⚙️" },
  Disposed: { color: "red-dark", emoji: "🗑️" },
  Lost: { color: "red", emoji: "❗" },
  Retained: { color: "indigo", emoji: "🧾" },
  "MRN Cancelled": { color: "red-dark", emoji: "🚫" },
};

const EMPTY_FILTERS = {
  eventType: "",
  assetId: "",
  fromEmployeeId: "",
  toEmployeeId: "",
  daybookId: "",
  issuedItemId: "",
  fromDate: "",
  toDate: "",
};

function buildApprovalViewUrl(encryptedPath) {
  if (!encryptedPath) return null;
  const normalized = String(encryptedPath).replace(/^\/+/, "");
  const relativePath = normalized.startsWith("uploads/")
    ? normalized.slice("uploads/".length)
    : normalized;
  return `http://localhost:3000/api/v1/view-image?path=${encodeURIComponent(
    relativePath,
  )}`;
}

function formatPerson(person, fallbackId) {
  if (!person && !fallbackId) return "—";
  if (!person) return `ID: ${fallbackId}`;
  return `${person.emp_id} | ${person.name} (${person.division || "-"})`;
}

export default function AssetEvents() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [employees, setEmployees] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const filterRef = useRef(null);

  const [serverTotal, setServerTotal] = useState(0);

  const activeFilterCount = useMemo(() => {
    const filterCount = Object.values(filters).filter((v) => String(v || "").trim()).length;
    return filterCount + (debouncedSearch ? 1 : 0);
  }, [filters, debouncedSearch]);

  const columns = [
    { key: "id", label: "Event ID" },
    {
      key: "event_type",
      label: "Type",
      chip: true,
      chipMap: EVENT_CHIPS,
    },
    {
      key: "event_date",
      label: "Event Date",
      render: (v) => (v ? new Date(v).toLocaleString() : "—"),
    },
    {
      key: "asset_id",
      label: "Asset",
      render: (_, row) => {
        const serial = row.asset?.serial_number || "—";
        const tag = row.asset?.asset_tag || "—";
        const item = row.asset?.item_name || "—";
        return `#${row.asset_id} | SN: ${serial} | TAG: ${tag} | ${item}`;
      },
    },
    {
      key: "from_employee",
      label: "From",
      render: (_, row) => formatPerson(row.from_employee, row.from_employee_id),
    },
    {
      key: "to_employee",
      label: "To",
      render: (_, row) => formatPerson(row.to_employee, row.to_employee_id),
    },
    { key: "daybook_id", label: "DayBook ID" },
    { key: "issued_item_id", label: "Issued Item ID" },
    {
      key: "notes",
      label: "Notes",
      render: (v) => (v ? v : "—"),
    },
    {
      key: "approval_document_url",
      label: "Noting Approval",
      render: (v) => {
        const viewUrl = buildApprovalViewUrl(v);
        if (!viewUrl) return "—";
        return (
          <a
            href={viewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            View Approval
          </a>
        );
      },
    },
  ];

  const closeFilterPanel = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowFilters(false);
      setIsClosing(false);
    }, 160);
  };

  const fetchDataPage = useCallback(
    async ({ cursor, limit }) => {
      const params = {
        search: debouncedSearch || undefined,
        limit,
        cursorMode: true,
        cursor: cursor || undefined,
      };

      Object.entries(filters).forEach(([k, v]) => {
        if (String(v || "").trim()) params[k] = v;
      });

      const res = await axios.get("http://localhost:3000/api/v1/asset-events", {
        params,
      });
      const nextMeta = res?.data?.meta || {};
      if (typeof nextMeta.total === "number") {
        setServerTotal(nextMeta.total);
      }
      return {
        rows: res?.data?.data || [],
        meta: nextMeta,
      };
    },
    [debouncedSearch, filters],
  );

  const {
    rows,
    loading,
    isFetchingMore,
    hasMore,
    loadMore,
    virtualStartIndex,
  } = useCursorWindowedList({
    fetchPage: fetchDataPage,
    deps: [debouncedSearch, filters],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  useEffect(() => {
    axios
      .get("http://localhost:3000/api/v1/employee")
      .then((r) => setEmployees(r.data?.data || []))
      .catch(() => setEmployees([]));
  }, []);

  return (
    <ListPage
      title="Asset Events"
      data={rows}
      loading={loading}
      searchValue={search}
      onSearch={setSearch}
      searchPlaceholder="Search by event, asset, employee, notes..."
      showAdd={false}
      showUpdate={false}
      onFilter={() => {
        if (showFilters) closeFilterPanel();
        else setShowFilters(true);
      }}
      aboveContent={
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">Total Results</div>
              <div className="text-lg font-semibold text-slate-800">
                {serverTotal || rows.length}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">Active Filters</div>
              <div className="text-lg font-semibold text-slate-800">{activeFilterCount}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">Rows Loaded</div>
              <div className="text-lg font-semibold text-slate-800">{rows.length}</div>
            </div>
          </div>

          {showFilters && (
            <div ref={filterRef} className="relative z-50">
              <FilterPanel
                title="Asset Event Filters"
                fields={[
                  {
                    key: "eventType",
                    label: "Event Type",
                    type: "select",
                    options: EVENT_TYPES.map((t) => ({ value: t, label: t })),
                  },
                  { key: "assetId", label: "Asset ID", type: "text" },
                  {
                    key: "fromEmployeeId",
                    label: "From Employee",
                    type: "select",
                    options: employees.map((e) => ({
                      value: e.emp_id,
                      label: `${e.emp_id} | ${e.name} (${e.division})`,
                    })),
                  },
                  {
                    key: "toEmployeeId",
                    label: "To Employee",
                    type: "select",
                    options: employees.map((e) => ({
                      value: e.emp_id,
                      label: `${e.emp_id} | ${e.name} (${e.division})`,
                    })),
                  },
                  { key: "daybookId", label: "DayBook ID", type: "text" },
                  { key: "issuedItemId", label: "Issued Item ID", type: "text" },
                  { key: "fromDate", label: "From Date", type: "date" },
                  { key: "toDate", label: "To Date", type: "date" },
                ]}
                filters={filters}
                onChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
                onReset={() => {
                  setFilters(EMPTY_FILTERS);
                  closeFilterPanel();
                }}
                onClose={closeFilterPanel}
                isClosing={isClosing}
              />
            </div>
          )}
        </div>
      }
      table={
        <ListTable
          data={rows}
          columns={columns}
          idCol="asset_id"
          loading={isFetchingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
          virtualStartIndex={virtualStartIndex}
          onRowClick={(assetId) => {
            if (!assetId) return;
            navigate(`/asset/${assetId}/timeline`);
          }}
        />
      }
    />
  );
}
