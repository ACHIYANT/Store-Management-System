import React, { useCallback, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { toStoreApiUrl } from "@/lib/api-config";

const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

const normalizeStatusLabel = (value) =>
  String(value || "")
    .trim()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");

const previewUrl = (storedUrl) => {
  if (!storedUrl) return "";
  const relativePath = storedUrl.replace(/^\/?uploads\//, "");
  return toStoreApiUrl(`/view-image?path=${encodeURIComponent(relativePath)}`);
};

export default function Mir() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 400);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchMirPage = useCallback(
    async ({ cursor, limit }) => {
      const response = await axios.get(toStoreApiUrl("/mirs"), {
        params: {
          search: debouncedSearchTerm || undefined,
          status: statusFilter || undefined,
          limit,
          cursorMode: true,
          cursor: cursor || undefined,
        },
      });
      return {
        rows: response?.data?.data || [],
        meta: response?.data?.meta || {},
      };
    },
    [debouncedSearchTerm, statusFilter],
  );

  const {
    rows,
    loading,
    hasMore,
    loadMore,
    virtualStartIndex,
  } = useCursorWindowedList({
    fetchPage: fetchMirPage,
    deps: [debouncedSearchTerm, statusFilter],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const columns = [
    { key: "mir_no", label: "MIR No", sortable: true },
    { key: "requisition_req_no", label: "Requisition No", sortable: true },
    {
      key: "issued_at",
      label: "Issue Date",
      sortable: true,
      render: (value) => (value ? new Date(value).toLocaleString() : "—"),
    },
    {
      key: "receiver_type",
      label: "Receiver Type",
      chip: true,
      chipMap: {
        EMPLOYEE: { color: "blue", emoji: "👤" },
        DIVISION: { color: "green", emoji: "🏢" },
        VEHICLE: { color: "yellow", emoji: "🚘" },
      },
    },
    { key: "receiver_name", label: "Receiver" },
    {
      key: "signatory_name",
      label: "Signatory",
      render: (_value, row) =>
        row?.signatory_name || normalizeStatusLabel(row?.signatory_role) || "Pending assignment",
    },
    { key: "requester_name", label: "Requester" },
    { key: "requester_division", label: "Requester Division" },
    {
      key: "status",
      label: "MIR Status",
      chip: true,
      chipMap: {
        PENDING_SIGNATURE: { color: "red", emoji: "🟥" },
        SIGNED_UPLOADED: { color: "green", emoji: "🟩" },
      },
      render: (value) => normalizeStatusLabel(value) || "—",
    },
    {
      key: "signed_mir_url",
      label: "Signed Copy",
      render: (value) =>
        value ? (
          <button
            type="button"
            className="text-blue-600 underline hover:text-blue-800"
            onClick={(event) => {
              event.stopPropagation();
              window.open(previewUrl(value), "_blank", "noopener,noreferrer");
            }}
          >
            View
          </button>
        ) : (
          "Pending"
        ),
    },
  ];

  return (
    <ListPage
      title="Material Issue Receipt"
      data={rows}
      showAdd={false}
      showUpdate={false}
      showFilter={false}
      searchPlaceholder="Search by MIR, requisition, receiver, or requester"
      onSearch={(term) => setSearchTerm(term)}
      searchValue={searchTerm}
      aboveContent={
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <label className="text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-sm outline-none"
            >
              <option value="">All</option>
              <option value="PENDING_SIGNATURE">Pending Signature</option>
              <option value="SIGNED_UPLOADED">Signed Uploaded</option>
            </select>
          </div>
        </div>
      }
      table={
        <ListTable
          columns={columns}
          data={rows}
          idCol="id"
          onRowClick={(mirId) => navigate(`/mir-page/${mirId}`)}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={loading}
          virtualStartIndex={virtualStartIndex}
        />
      }
      loading={loading}
    />
  );
}
