import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import FilterPanel from "@/components/FilterPanel";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { toStoreApiUrl } from "@/lib/api-config";

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
  return toStoreApiUrl(`/view-image?path=${encodeURIComponent(relativePath)}`);
}

function resolveNotingLink(row) {
  const approvalUrl = buildApprovalViewUrl(row?.approval_document_url);
  if (approvalUrl) {
    return {
      href: approvalUrl,
      label: "View Approval",
      external: true,
    };
  }

  if (String(row?.event_type || "") !== "Issued") return null;

  const source = String(row?.issued_item_source || "").toUpperCase();
  const requisitionId = row?.requisition_id ?? null;
  const requisitionReqNo = row?.requisition_req_no ?? null;
  const offlineReqUrl = buildApprovalViewUrl(row?.requisition_url);

  if (source === "OFFLINE_REQUISITION" && offlineReqUrl) {
    return {
      href: offlineReqUrl,
      label: "Offline Requisition",
      external: true,
    };
  }

  if (requisitionId) {
    return {
      href: `/requisitions/${requisitionId}`,
      label: requisitionReqNo || `Online Req #${requisitionId}`,
      external: false,
    };
  }

  if (offlineReqUrl) {
    return {
      href: offlineReqUrl,
      label: "Offline Requisition",
      external: true,
    };
  }

  return null;
}

function formatPerson(person, fallbackId) {
  if (!person && !fallbackId) return "—";
  const empId = person?.emp_id ?? fallbackId ?? "-";
  const name = person?.name ?? "-";
  const division = person?.division ?? "-";
  const location = person?.office_location ?? person?.location ?? "-";
  return `EMPLOYEE | ${empId} | ${name} | ${division} | ${location}`;
}

function formatCustodian(custodian, fallbackId, fallbackType) {
  const id = custodian?.id ?? fallbackId ?? null;
  const type = custodian?.type ?? fallbackType ?? null;
  const name = custodian?.name ?? custodian?.display_name ?? null;
  const location = custodian?.location ?? null;
  if (!id && !type && !name && !location) return "—";
  const normalizedType = String(type || "CUSTODIAN").toUpperCase();
  return `${normalizedType} | ${id || "-"} | ${name || "-"} | ${location || "-"}`;
}

const EVENT_DEFAULT_PARTIES = {
  Created: { from: "Procurement Process", to: "Store" },
  Issued: { from: "Store", to: "Custodian" },
  Returned: { from: "Custodian", to: "Store" },
  Transferred: { from: "From Custodian", to: "To Custodian" },
  SubmittedToStore: { from: "Custodian", to: "Store" },
  RepairOut: { from: "Store / Custodian", to: "Repair Vendor" },
  RepairIn: { from: "Repair Vendor", to: "Store" },
  MarkedEWaste: { from: "Store", to: "E-Waste Yard" },
  EWasteOut: { from: "E-Waste Yard", to: "E-Waste Vendor" },
  Adjusted: { from: "System", to: "System" },
  Disposed: { from: "Store", to: "Disposed" },
  Lost: { from: "Custodian / Store", to: "Lost" },
  Retained: { from: "Custodian", to: "Retained by Custodian" },
  "MRN Cancelled": { from: "System", to: "Store" },
};

function resolveParty(row, side) {
  const person = side === "from" ? row.from_employee : row.to_employee;
  const personId = side === "from" ? row.from_employee_id : row.to_employee_id;
  if (person || personId) return formatPerson(person, personId);

  const sideCustodian = side === "from" ? row.from_custodian : row.to_custodian;
  const sideCustodianId =
    side === "from" ? row.from_custodian_id : row.to_custodian_id;
  const sideCustodianType =
    side === "from" ? row.from_custodian_type : row.to_custodian_type;
  if (sideCustodian || sideCustodianId || sideCustodianType) {
    return formatCustodian(sideCustodian, sideCustodianId, sideCustodianType);
  }

  const eventType = String(row.event_type || "");
  const fallbackCustodian =
    side === "to" && ["Issued", "Transferred", "Retained"].includes(eventType)
      ? row.custodian
      : side === "from" && ["Returned", "SubmittedToStore"].includes(eventType)
        ? row.custodian
        : null;
  if (fallbackCustodian) {
    return formatCustodian(
      fallbackCustodian,
      row.custodian_id,
      row.custodian_type,
    );
  }

  return EVENT_DEFAULT_PARTIES[eventType]?.[side] || "—";
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
    const filterCount = Object.values(filters).filter((v) =>
      String(v || "").trim(),
    ).length;
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
      render: (_, row) => resolveParty(row, "from"),
    },
    {
      key: "to_employee",
      label: "To",
      render: (_, row) => resolveParty(row, "to"),
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
      render: (_v, row) => {
        const link = resolveNotingLink(row);
        if (!link) return "—";
        if (link.external) {
          return (
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              {link.label}
            </a>
          );
        }
        return (
          <Link to={link.href} className="text-emerald-700 underline">
            {link.label}
          </Link>
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

      const res = await axios.get(toStoreApiUrl("/asset-events"), {
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
      .get(toStoreApiUrl("/employee"))
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
              <div className="text-lg font-semibold text-slate-800">
                {activeFilterCount}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs text-slate-500">Rows Loaded</div>
              <div className="text-lg font-semibold text-slate-800">
                {rows.length}
              </div>
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
                  {
                    key: "issuedItemId",
                    label: "Issued Item ID",
                    type: "text",
                  },
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
