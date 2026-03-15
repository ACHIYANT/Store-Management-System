import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import FilterPanel from "@/components/FilterPanel";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { Link } from "react-router-dom";
import { DEFAULT_SKU_UNIT } from "@/constants/skuUnits";
import { toStoreApiUrl } from "@/lib/api-config";

const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

export default function IssuedItems() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const [filters, setFilters] = useState({
    employeeId: "",
    custodianType: "",
    categoryId: "",
    itemType: "", // Asset | Consumable
    fromDate: "",
    toDate: "",
  });

  const [showFilters, setShowFilters] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const filterRef = useRef(null);

  const [employees, setEmployees] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    axios
      .get(toStoreApiUrl("/employee"))
      .then((r) => setEmployees(r.data.data || []));

    axios
      .get(toStoreApiUrl("/itemCategories"))
      .then((r) => setCategories(r.data.data || []));
  }, []);

  // helper: make URL absolute for preview
  const previewUrl = (storedUrl) => {
    if (!storedUrl) return "";
    // storedUrl looks like "/uploads/requisitions/CI-2025-...enc"
    const rel = storedUrl.replace(/^\/?uploads\//, ""); // -> "requisitions/....enc"
    return toStoreApiUrl(`/view-image?path=${encodeURIComponent(rel)}`);
  };
  const fetchIssuedPage = useCallback(
    async ({ cursor, limit }) => {
      const res = await axios.get(toStoreApiUrl("/issued-items"), {
        params: {
          search: debouncedSearch || undefined,
          ...filters,
          limit,
          cursorMode: true,
          cursor: cursor || undefined,
        },
      });
      return {
        rows: res?.data?.data || [],
        meta: res?.data?.meta || {},
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
    fetchPage: fetchIssuedPage,
    deps: [debouncedSearch, filters],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  /* ---------------- Filter close ---------------- */

  const closeFilterPanel = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowFilters(false);
      setIsClosing(false);
    }, 160);
  };

  /* ---------------- Columns ---------------- */

  const columns = [
    { key: "id", label: "Issue ID" },
    {
      key: "date",
      label: "Date",
      render: (v) => new Date(v).toLocaleString(),
    },
    { key: "employee_id", label: "Employee ID" },
    { key: "employee_name", label: "Employee" },
    { key: "division", label: "Division" },
    {
      key: "custodian_name",
      label: "Custodian",
      render: (_v, row) =>
        row?.custodian_name || row?.employee_name || "—",
    },
    {
      key: "custodian_type",
      label: "Custodian Type",
      render: (v, row) =>
        v || (row?.employee_id ? "EMPLOYEE" : "—"),
    },
    { key: "category_name", label: "Category" },
    { key: "item_name", label: "Item" },
    {
      key: "type_label",
      label: "Type",
      chip: true,
      chipMap: {
        Asset: { color: "blue", emoji: "🧰" },
        Consumable: { color: "green", emoji: "🧴" },
      },
    },
    {
      key: "quantity",
      label: "Qty",
      render: (val, row) => `${val ?? 0} ${row?.sku_unit || DEFAULT_SKU_UNIT}`,
    },
    { key: "sku_unit", label: "SKU Unit" },
    {
      key: "assets",
      label: "Serials / Asset Tags",
      render: (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) return "—";
        const labels = arr.map(
          (a) => a.serial_number || a.asset_tag || a.asset_id,
        );
        const preview = labels.slice(0, 3).join(", ");
        return labels.length > 3
          ? `${preview} +${labels.length - 3} more`
          : preview;
      },
    },
    // NEW: Requisition preview column
    {
      key: "requisition_ref",
      label: "Requisition",
      render: (_v, row) => {
        const onlineReqId = row?.requisition_id;
        const onlineReqNo = row?.requisition_req_no;
        const offlineReqUrl = row?.requisition_url;

        if (!onlineReqId && !offlineReqUrl) return "—";

        return (
          <div className="flex flex-col gap-1">
            {onlineReqId ? (
              <Link to={`/requisitions/${onlineReqId}`} className="text-emerald-700 underline">
                {onlineReqNo || `Online Req #${onlineReqId}`}
              </Link>
            ) : null}
            {offlineReqUrl ? (
              <a
                href={previewUrl(offlineReqUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                Offline Copy
              </a>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <ListPage
      title="Issued Items"
      searchValue={search}
      onSearch={setSearch}
      data={rows}
      loading={loading}
      onFilter={() => {
        if (showFilters) closeFilterPanel();
        else setShowFilters(true);
      }}
      showAdd={false}
      showUpdate={false}
      aboveContent={
        showFilters && (
          <div ref={filterRef} className="relative z-50">
            <FilterPanel
              title="Issued Item Filters"
              fields={[
                {
                  key: "employeeId",
                  label: "Employee",
                  type: "select",
                  options: employees?.map((e) => ({
                    value: e.emp_id,
                    label: `${e.name} (${e.division})`,
                  })),
                },
                {
                  key: "custodianType",
                  label: "Custodian Type",
                  type: "select",
                  options: [
                    { value: "EMPLOYEE", label: "Employee" },
                    { value: "DIVISION", label: "Division" },
                    { value: "VEHICLE", label: "Vehicle" },
                  ],
                },
                {
                  key: "categoryId",
                  label: "Category",
                  type: "select",
                  options: categories?.map((c) => ({
                    value: c.id,
                    label: c.category_name,
                  })),
                },
                {
                  key: "itemType",
                  label: "Item Type",
                  type: "select",
                  options: [
                    { value: "Asset", label: "Asset" },
                    { value: "Consumable", label: "Consumable" },
                  ],
                },
                { key: "fromDate", label: "From Date", type: "date" },
                { key: "toDate", label: "To Date", type: "date" },
              ]}
              filters={filters}
              onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
              onReset={() => {
                setFilters({
                  employeeId: "",
                  custodianType: "",
                  categoryId: "",
                  itemType: "",
                  fromDate: "",
                  toDate: "",
                });
                closeFilterPanel();
              }}
              onClose={closeFilterPanel}
              isClosing={isClosing}
            />
          </div>
        )
      }
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
