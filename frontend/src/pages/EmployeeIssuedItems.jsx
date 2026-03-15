import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { DEFAULT_SKU_UNIT } from "@/constants/skuUnits";
import { STORE_API_BASE_URL, toStoreApiUrl } from "@/lib/api-config";

const API = STORE_API_BASE_URL;
const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;
const PRINT_PAGE_SIZE = 500;
const PRINT_MAX_ROWS = 20000;
const CUSTODIAN_TYPES = new Set(["EMPLOYEE", "DIVISION", "VEHICLE"]);
const inferCustodianTypeFromId = (value) => {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (text.startsWith("DIV-")) return "DIVISION";
  if (text.startsWith("VEH-")) return "VEHICLE";
  return "";
};
const isValidAssetId = (value) => {
  if (value == null) return false;
  const normalized = String(value).trim();
  return normalized !== "" && normalized !== "-";
};
const renderAssetLink = (assetId, label) => {
  if (!isValidAssetId(assetId)) return label ?? "-";
  return (
    <Link
      to={`/asset/${assetId}/timeline`}
      className="text-blue-600 underline hover:text-blue-800"
    >
      {label ?? "-"}
    </Link>
  );
};

function StyledModal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-2xl rounded-lg border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function normalizeIssuedRow(row) {
  return {
    ...row,
    id: row.id ?? row.issued_item_id ?? null,
    item_name: row.item_name ?? row.itemName ?? row.name ?? "-",
    category_name: row.category_name ?? row.category ?? null,
    custodian_id: row.custodian_id ?? null,
    custodian_type: row.custodian_type ?? null,
    custodian_name:
      row.custodian_name ?? row.employee_name ?? row.employee?.name ?? null,
    quantity: row.quantity ?? row.qty ?? row.issue_qty ?? 0,
    sku_unit: row.sku_unit ?? row.skuUnit ?? DEFAULT_SKU_UNIT,
    issue_date: row.issue_date ?? row.issued_at ?? row.date ?? null,
    daybook_no: row.daybook_no ?? row.daybook_entry_no ?? row.daybook_id ?? "-",
    asset_id: row?.assets?.[0]?.asset_id ?? "-",
    asset_tag: row?.assets?.[0]?.asset_tag ?? "-",
    serial_number: row?.assets?.[0]?.serial_number ?? "-",
    requisition_url: row.requisition_url ?? null,
    remarks: row.remarks ?? row.note ?? "",
  };
}

function parseCursorMeta(meta) {
  const nextCursor =
    typeof meta?.nextCursor === "string" && meta.nextCursor.trim() !== ""
      ? meta.nextCursor
      : null;

  return {
    hasMore: Boolean(meta?.hasMore),
    nextCursor,
  };
}

export default function EmployeeIssuedItems() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const custodianType = useMemo(() => {
    const raw = String(queryParams.get("custodianType") || "")
      .trim()
      .toUpperCase();
    if (CUSTODIAN_TYPES.has(raw)) return raw;
    return inferCustodianTypeFromId(id);
  }, [id, queryParams]);
  const custodianId = id ? decodeURIComponent(String(id)) : "";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [categories, setCategories] = useState([]);
  const [stockOptions, setStockOptions] = useState([]);

  const [filters, setFilters] = useState({
    categoryId: "",
    stockId: "",
    fromDate: "",
    toDate: "",
  });

  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState(filters);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTruncated, setPreviewTruncated] = useState(false);

  useEffect(() => {
    setTempFilters(filters);
  }, [filters]);

  useEffect(() => {
    (async function fetchCategories() {
      try {
        const res = await axios.get(`${API}/itemCategories`);
        setCategories(res.data?.data || []);
      } catch {
        setCategories([]);
      }
    })();

    (async function fetchStocks() {
      try {
        const res = await axios.get(`${API}/stocks`);
        setStockOptions(res.data?.data || []);
      } catch {
        setStockOptions([]);
      }
    })();
  }, []);

  const fetchRows = useCallback(
    async ({ cursor, limit }) => {
      if (!id) {
        return {
          rows: [],
          meta: { hasMore: false, nextCursor: null },
        };
      }

      const params = {
        limit,
        cursorMode: true,
        cursor: cursor || undefined,
        search: debouncedSearch || undefined,
        stockId: filters.stockId || undefined,
        categoryId: filters.categoryId || undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
      };
      if (custodianType) {
        params.custodianId = custodianId;
        params.custodianType = custodianType;
      } else {
        params.employeeId = custodianId;
      }

      const resp = await axios.get(`${API}/issued-items`, { params });
      const rows = (resp.data?.data || []).map(normalizeIssuedRow);
      const meta = parseCursorMeta(resp.data?.meta || {});

      return { rows, meta };
    },
    [
      debouncedSearch,
      filters.categoryId,
      filters.fromDate,
      filters.stockId,
      filters.toDate,
      custodianId,
      custodianType,
    ],
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
    deps: [
      id,
      debouncedSearch,
      filters.categoryId,
      filters.stockId,
      filters.fromDate,
      filters.toDate,
      custodianType,
    ],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
    enabled: Boolean(id),
  });

  const fetchAllRowsForPrint = useCallback(async () => {
    if (!id) return { rows: [], truncated: false };

    const all = [];
    let cursor = null;
    let hasMore = true;

    while (hasMore && all.length < PRINT_MAX_ROWS) {
      const params = {
        limit: PRINT_PAGE_SIZE,
        cursorMode: true,
        cursor: cursor || undefined,
        search: debouncedSearch || undefined,
        stockId: filters.stockId || undefined,
        categoryId: filters.categoryId || undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
      };
      if (custodianType) {
        params.custodianId = custodianId;
        params.custodianType = custodianType;
      } else {
        params.employeeId = custodianId;
      }

      const resp = await axios.get(`${API}/issued-items`, { params });
      const pageRows = resp.data?.data || [];
      all.push(...pageRows);

      const meta = parseCursorMeta(resp.data?.meta || {});
      cursor = meta.nextCursor;
      hasMore = meta.hasMore && Boolean(cursor) && pageRows.length > 0;
    }

    return {
      rows: all.slice(0, PRINT_MAX_ROWS).map(normalizeIssuedRow),
      truncated: hasMore,
    };
  }, [
    debouncedSearch,
    filters.categoryId,
    filters.fromDate,
    filters.stockId,
    filters.toDate,
    custodianId,
    custodianType,
  ]);

  const openPrintPreview = useCallback(async () => {
    try {
      setPreviewLoading(true);
      const result = await fetchAllRowsForPrint();
      setPreviewRows(result.rows);
      setPreviewTruncated(result.truncated);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Failed to load preview rows:", error);
      window.alert("Failed to prepare preview. See console for details.");
    } finally {
      setPreviewLoading(false);
    }
  }, [fetchAllRowsForPrint]);

  const previewUrl = useCallback((storedUrl) => {
    if (!storedUrl) return "";
    const rel = storedUrl.replace(/^\/?uploads\//, "");
    return toStoreApiUrl(`/view-image?path=${encodeURIComponent(rel)}`);
  }, []);

  const columns = useMemo(
    () => [
      { key: "id", label: "ID" },
      { key: "item_name", label: "Item Name" },
      { key: "category_name", label: "Category Name" },
      {
        key: "custodian_name",
        label: "Custodian",
        render: (val, row) => val || row?.employee_name || "-",
      },
      {
        key: "custodian_type",
        label: "Custodian Type",
        render: (val, row) => val || (row?.employee_id ? "EMPLOYEE" : "-"),
      },
      {
        key: "quantity",
        label: "Quantity",
        render: (val, row) =>
          `${val ?? 0} ${row?.sku_unit || DEFAULT_SKU_UNIT}`,
      },
      { key: "sku_unit", label: "SKU Unit" },
      {
        key: "issue_date",
        label: "Issue Date",
        render: (val) => (val ? new Date(val).toLocaleString() : "-"),
      },
      { key: "daybook_no", label: "DayBook Ref" },
      {
        key: "asset_id",
        label: "Asset Id",
        render: (val, row) => renderAssetLink(row?.asset_id, val),
      },
      {
        key: "asset_tag",
        label: "Asset Tag",
        render: (val, row) => renderAssetLink(row?.asset_id, val),
      },
      {
        key: "serial_number",
        label: "Serial Number",
        render: (val, row) => renderAssetLink(row?.asset_id, val),
      },
      {
        key: "requisition_url",
        label: "Requisition",
        render: (v) =>
          v ? (
            <a
              href={previewUrl(v)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              View
            </a>
          ) : (
            "-"
          ),
      },
      { key: "remarks", label: "Remarks" },
    ],
    [previewUrl],
  );

  const activeFilterCount = Object.entries(filters).reduce(
    (count, [, value]) => count + (String(value || "").trim() !== "" ? 1 : 0),
    0,
  );

  return (
    <>
      <button
        className="mb-4 rounded bg-black px-4 py-2 text-white hover:bg-zinc-600"
        onClick={() => navigate(-1)}
      >
        Back
      </button>

      <div className="listpage-root">
        <ListPage
          title={`Issued Items - ${custodianType || "EMPLOYEE"}: ${custodianId}`}
          data={rows}
          columns={columns}
          loading={loading}
          searchValue={search}
          onSearch={setSearch}
          searchPlaceholder="Search item, category, asset tag, serial..."
          showAdd={false}
          showUpdate={false}
          actions={[
            {
              label: (
                <span className="flex items-center gap-2">
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full border border-blue-600 bg-white px-2 py-0.5 text-xs font-medium text-black">
                      {activeFilterCount}
                    </span>
                  )}
                </span>
              ),
              onClick: () => {
                setTempFilters(filters);
                setFiltersModalOpen(true);
              },
            },
            {
              label: "Reset",
              onClick: () => {
                setFilters({
                  categoryId: "",
                  stockId: "",
                  fromDate: "",
                  toDate: "",
                });
                setSearch("");
              },
            },
            {
              label: "Print",
              onClick: openPrintPreview,
            },
          ]}
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
      </div>

      <StyledModal
        isOpen={filtersModalOpen}
        onClose={() => {
          setFiltersModalOpen(false);
          setTempFilters(filters);
        }}
        title="Filters"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFilters({
              categoryId: tempFilters.categoryId || "",
              stockId: tempFilters.stockId || "",
              fromDate: tempFilters.fromDate || "",
              toDate: tempFilters.toDate || "",
            });
            setFiltersModalOpen(false);
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="mb-1 text-sm text-gray-600">Category</label>
              <select
                value={tempFilters.categoryId}
                onChange={(e) =>
                  setTempFilters({ ...tempFilters, categoryId: e.target.value })
                }
                className="rounded border px-3 py-2"
              >
                <option value="">All</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.category_name ?? category.name ?? category.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-1 text-sm text-gray-600">Item / Stock</label>
              <select
                value={tempFilters.stockId}
                onChange={(e) =>
                  setTempFilters({ ...tempFilters, stockId: e.target.value })
                }
                className="rounded border px-3 py-2"
              >
                <option value="">All</option>
                {stockOptions.map((stock) => (
                  <option
                    key={stock.id ?? stock._id}
                    value={stock.id ?? stock._id}
                  >
                    {stock.item_name ??
                      stock.name ??
                      `Stock #${stock.id ?? stock._id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="mb-1 text-sm text-gray-600">From</label>
              <input
                type="date"
                value={tempFilters.fromDate || ""}
                onChange={(e) =>
                  setTempFilters({ ...tempFilters, fromDate: e.target.value })
                }
                className="rounded border px-3 py-2"
              />
            </div>

            <div className="flex flex-col">
              <label className="mb-1 text-sm text-gray-600">To</label>
              <input
                type="date"
                value={tempFilters.toDate || ""}
                onChange={(e) =>
                  setTempFilters({ ...tempFilters, toDate: e.target.value })
                }
                className="rounded border px-3 py-2"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setTempFilters({
                  categoryId: "",
                  stockId: "",
                  fromDate: "",
                  toDate: "",
                })
              }
              className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
            >
              Reset
            </button>

            <button
              type="submit"
              className="rounded bg-blue-600 px-3 py-1 text-white"
            >
              Apply
            </button>
          </div>
        </form>
      </StyledModal>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setPreviewOpen(false)}
          />
          <div className="relative z-10 w-full max-w-6xl overflow-auto rounded bg-white p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  Issued Items - Print Preview
                </h3>
                <p className="text-xs text-gray-600">
                  Preview of filtered data. Use Print to print only this
                  preview.
                </p>
                {previewTruncated && (
                  <p className="mt-1 text-xs text-amber-700">
                    Showing first {PRINT_MAX_ROWS} rows only in preview.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="rounded border bg-white px-3 py-1 text-sm shadow-sm"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="rounded bg-blue-600 px-3 py-1 text-sm text-white print:hidden"
                >
                  Print
                </button>
              </div>
            </div>

            <div id="print-area" className="overflow-auto">
              <style>{`
                @media print {
                  body * { visibility: hidden !important; }
                  #print-area, #print-area * { visibility: visible !important; }
                  #print-area { position: absolute; left: 0; top: 0; width: 100%; }
                  .no-print { display: none !important; }
                }
              `}</style>

              <div className="mb-3 text-sm text-gray-600">
                <strong>Filters:</strong> {JSON.stringify(filters)}
              </div>

              <table
                className="min-w-full border-collapse"
                style={{ borderCollapse: "collapse" }}
              >
                <thead>
                  <tr>
                    <th style={{ padding: 8, border: "1px solid #ddd" }}>ID</th>
                    <th style={{ padding: 8, border: "1px solid #ddd" }}>
                      Item Name
                    </th>
                    <th style={{ padding: 8, border: "1px solid #ddd" }}>
                      Category
                    </th>
                    <th style={{ padding: 8, border: "1px solid #ddd" }}>
                      Quantity
                    </th>
                    <th style={{ padding: 8, border: "1px solid #ddd" }}>
                      SKU Unit
                    </th>
                    <th style={{ padding: 8, border: "1px solid #ddd" }}>
                      Issue Date
                    </th>
                    <th style={{ padding: 8, border: "1px solid #ddd" }}>
                      DayBook Ref
                    </th>
                    <th style={{ padding: 8, border: "1px solid #ddd" }}>
                      Asset Id
                    </th>
                    <th style={{ padding: 8, border: "1px solid #ddd" }}>
                      Asset Tag
                    </th>
                    <th style={{ padding: 8, border: "1px solid #ddd" }}>
                      Serial Number
                    </th>
                    <th style={{ padding: 8, border: "1px solid #ddd" }}>
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewLoading ? (
                    <tr>
                      <td
                        colSpan={11}
                        style={{ padding: 12, textAlign: "center" }}
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : previewRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        style={{ padding: 12, textAlign: "center" }}
                      >
                        No records
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((row) => (
                      <tr
                        key={`${row.id}-${row.asset_id}-${row.serial_number}`}
                      >
                        <td style={{ padding: 6, border: "1px solid #ddd" }}>
                          {row.id}
                        </td>
                        <td style={{ padding: 6, border: "1px solid #ddd" }}>
                          {row.item_name}
                        </td>
                        <td style={{ padding: 6, border: "1px solid #ddd" }}>
                          {row.category_name}
                        </td>
                        <td style={{ padding: 6, border: "1px solid #ddd" }}>
                          {row.quantity}
                        </td>
                        <td style={{ padding: 6, border: "1px solid #ddd" }}>
                          {row.sku_unit || DEFAULT_SKU_UNIT}
                        </td>
                        <td style={{ padding: 6, border: "1px solid #ddd" }}>
                          {row.issue_date
                            ? new Date(row.issue_date).toLocaleString()
                            : ""}
                        </td>
                        <td style={{ padding: 6, border: "1px solid #ddd" }}>
                          {row.daybook_no}
                        </td>
                        <td style={{ padding: 6, border: "1px solid #ddd" }}>
                          {row.asset_id}
                        </td>
                        <td style={{ padding: 6, border: "1px solid #ddd" }}>
                          {row.asset_tag}
                        </td>
                        <td style={{ padding: 6, border: "1px solid #ddd" }}>
                          {row.serial_number}
                        </td>
                        <td style={{ padding: 6, border: "1px solid #ddd" }}>
                          {row.remarks}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
