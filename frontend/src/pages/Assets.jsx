import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import Modal from "@/components/Modal";
import AssetReturnForm from "@/components/Forms/AssetReturnForm";
import AssetTransferForm from "@/components/Forms/AssetTransferForm";
import AssetRepairForm from "@/components/Forms/AssetRepairForm";
import AssetFinalizeForm from "@/components/Forms/AssetFinalizeForm";
import AssetRetainForm from "@/components/Forms/AssetRetainForm";
import PopupMessage from "@/components/PopupMessage";
import FilterPanel from "@/components/FilterPanel";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { toStoreApiUrl } from "@/lib/api-config";

const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

export default function Assets() {
  const navigate = useNavigate();
  const location = useLocation();
  const { categoryId } = useParams();

  const normalizedParam = String(categoryId || "")
    .trim()
    .toLowerCase();
  const numericCategoryId = Number(categoryId);
  const isScopedCategoryView =
    normalizedParam !== "" &&
    normalizedParam !== "all" &&
    Number.isFinite(numericCategoryId);
  const scopedCategoryId = isScopedCategoryView ? numericCategoryId : null;

  const routeState = location.state || {};

  /* ------------------ State ------------------ */
  const [selected, setSelected] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [popup, setPopup] = useState({
    open: false,
    type: "success",
    message: "",
  });

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const [filters, setFilters] = useState({
    status: "",
    categoryHeadId: "",
    categoryGroupId: "",
    custodian_id: "",
    custodian_type: "",
    stock_id: "",
    from_date: "",
    to_date: "",
  });

  const [categoryHeads, setCategoryHeads] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [custodians, setCustodians] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const filterRef = useRef(null);

  /* ------------------ Columns ------------------ */
  const statusChipMap = {
    InStore: { color: "green", emoji: "🏬" },
    Issued: { color: "blue", emoji: "📦" },
    InTransit: { color: "yellow", emoji: "🚚" },
    Repair: { color: "purple", emoji: "🛠️" },
    EWaste: { color: "yellow", emoji: "♻️" },
    EWasteOut: { color: "indigo", emoji: "🚛" },
    Disposed: { color: "gray", emoji: "🗑️" },
    Lost: { color: "red", emoji: "❌" },
    Retained: { color: "indigo", emoji: "🧾" },
    "Removed as MRN Cancelled": { color: "red", emoji: "⛔" },
  };

  const columns = [
    { key: "id", label: "ID" },
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
    {
      key: "vendor_id",
      label: "Vendor",
      render: (_, row) => row.Vendor?.name || "-",
    },
    { key: "status", label: "Status", chip: true, chipMap: statusChipMap },
    { key: "asset_tag", label: "Asset Tag" },
    { key: "serial_number", label: "Serial" },
    {
      key: "purchased_at",
      label: "Purchased",
      render: (value) => (value ? new Date(value).toLocaleDateString() : "-"),
    },
    {
      key: "warranty_expiry",
      label: "Warranty",
      render: (value) => (value ? new Date(value).toLocaleDateString() : "-"),
    },
    {
      key: "custodian_name",
      label: "Custodian",
      render: (_, row) =>
        row.Custodian?.display_name || row.Employee?.name || "-",
    },
    {
      key: "custodian_id",
      label: "Custodian ID",
      render: (_, row) =>
        row.custodian_id ||
        row.Employee?.emp_id ||
        row.current_employee_id ||
        "-",
    },
    {
      key: "custodian_type",
      label: "Custodian Type",
      render: (_, row) =>
        row.custodian_type || (row.current_employee_id ? "EMPLOYEE" : "-"),
    },
    {
      key: "division",
      label: "Division / Location",
      render: (_, row) =>
        row.Employee?.division || row.Custodian?.location || "-",
    },
    { key: "notes", label: "Notes" },
  ];

  const fetchAssetsPage = useCallback(
    async ({ cursor, limit }) => {
      const res = await axios.get(toStoreApiUrl("/assets/search"), {
        params: {
          search: debouncedSearch || undefined,
          ...filters,
          category_id: scopedCategoryId || undefined,
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
    [debouncedSearch, filters, scopedCategoryId],
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
    fetchPage: fetchAssetsPage,
    deps: [debouncedSearch, filters, scopedCategoryId],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const categoryName = useMemo(() => {
    if (!isScopedCategoryView) return "All Assets";
    return (
      routeState?.categoryName ||
      rows?.[0]?.ItemCategory?.category_name ||
      `Category #${scopedCategoryId}`
    );
  }, [isScopedCategoryView, routeState?.categoryName, rows, scopedCategoryId]);

  /* ------------------ Effects ------------------ */
  useEffect(() => {
    setSelected([]);
  }, [debouncedSearch, filters, scopedCategoryId]);

  useEffect(() => {
    axios
      .get(toStoreApiUrl("/category-head"))
      .then((res) => setCategoryHeads(res.data.data || []));
  }, []);

  useEffect(() => {
    if (!filters.categoryHeadId) {
      setCategoryGroups([]);
      return;
    }

    axios
      .get(toStoreApiUrl(`/category-group/by-head/${filters.categoryHeadId}`))
      .then((res) => setCategoryGroups(res.data.data || []));
  }, [filters.categoryHeadId]);

  useEffect(() => {
    axios
      .get(toStoreApiUrl("/custodians"), {
        params: {
          include_inactive: true,
          limit: 1000,
        },
      })
      .then((res) => setCustodians(res.data.data || []));
  }, []);

  /* ------------------ Actions ------------------ */
  const getSelectedAssets = () => {
    const rowById = new Map(rows.map((row) => [Number(row.id), row]));
    return selected.map((id) => rowById.get(Number(id))).filter(Boolean);
  };

  const listStatuses = (assets) =>
    [...new Set(assets.map((asset) => asset?.status || "Unknown"))].join(", ");

  const openActionDialog = (nextDialog) => {
    if (!selected.length) {
      setPopup({
        open: true,
        type: "error",
        message: "Select at least one asset first.",
      });
      return;
    }

    const selectedAssets = getSelectedAssets();
    if (selectedAssets.length !== selected.length) {
      setPopup({
        open: true,
        type: "error",
        message:
          "Some selected assets are not loaded in the current view. Refresh and try again.",
      });
      return;
    }

    const allowedByAction = {
      return: new Set(["Issued"]),
      transfer: new Set(["Issued"]),
      repairOut: new Set(["InStore", "Issued"]),
      repairIn: new Set(["Repair"]),
      retain: new Set(["Issued"]),
    };

    if (allowedByAction[nextDialog]) {
      const allowed = allowedByAction[nextDialog];
      const invalid = selectedAssets.filter(
        (asset) => !allowed.has(String(asset.status)),
      );
      if (invalid.length) {
        setPopup({
          open: true,
          type: "error",
          message: `Invalid status for this action. Selected statuses: ${listStatuses(
            selectedAssets,
          )}.`,
        });
        return;
      }
    }

    if (nextDialog === "finalize") {
      const blocked = new Set([
        "EWaste",
        "EWasteOut",
        "Disposed",
        "Lost",
        "Retained",
        "Removed as MRN Cancelled",
      ]);
      const invalid = selectedAssets.filter((asset) =>
        blocked.has(String(asset.status)),
      );
      if (invalid.length) {
        setPopup({
          open: true,
          type: "error",
          message: `Finalize is not allowed for already final/removed assets. Selected statuses: ${listStatuses(
            selectedAssets,
          )}.`,
        });
        return;
      }
    }

    setDialog(nextDialog);
  };

  const handleActionDone = (success) => {
    if (!success) return;
    setDialog(null);
    setSelected([]);
    refresh();
  };

  const actions = [
    { label: "Return", onClick: () => openActionDialog("return") },
    { label: "Transfer", onClick: () => openActionDialog("transfer") },
    { label: "Repair Out", onClick: () => openActionDialog("repairOut") },
    { label: "Repair In", onClick: () => openActionDialog("repairIn") },
    {
      label: "Dispose / Lost / E-Waste",
      onClick: () => openActionDialog("finalize"),
    },
    { label: "Retain", onClick: () => openActionDialog("retain") },
  ];

  const resetFilters = () => {
    setFilters({
      status: "",
      categoryHeadId: "",
      categoryGroupId: "",
      custodian_id: "",
      custodian_type: "",
      stock_id: "",
      from_date: "",
      to_date: "",
    });
    closeFilterPanel();
  };

  const closeFilterPanel = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowFilters(false);
      setIsClosing(false);
    }, 160);
  };

  /* ------------------ Render ------------------ */
  return (
    <>
      <button
        type="button"
        className="mb-4 rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-700"
        onClick={() => navigate("/asset-categories")}
      >
        <span className="inline-flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Asset Categories
        </span>
      </button>

      {/* {isScopedCategoryView && (
        <div className="mb-4 rounded border bg-white px-4 py-3 text-sm text-gray-600">
          Viewing category:{" "}
          <span className="font-medium text-gray-900">{categoryName}</span>
        </div>
      )} */}

      <ListPage
        title="📦 Assets"
        data={rows}
        columns={columns}
        loading={loading}
        searchPlaceholder={
          isScopedCategoryView
            ? `Search inside ${categoryName}...`
            : "Search asset tag / serial / custodian / division / location..."
        }
        searchValue={search}
        onSearch={setSearch}
        onFilter={() =>
          showFilters ? closeFilterPanel() : setShowFilters(true)
        }
        showAdd={false}
        showUpdate={false}
        aboveContent={
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="h-9 rounded bg-slate-900 px-3 text-xs text-white whitespace-nowrap hover:bg-slate-800 sm:text-sm"
                >
                  {action.label}
                </button>
              ))}
            </div>

            {showFilters && (
              <div ref={filterRef} className="relative mt-4">
                <FilterPanel
                  title="Asset Filters"
                  fields={[
                    {
                      key: "status",
                      label: "Status",
                      type: "select",
                      options: [
                        { value: "InStore", label: "In Store" },
                        { value: "Issued", label: "Issued" },
                        { value: "InTransit", label: "In Transit" },
                        { value: "Repair", label: "Repair" },
                        { value: "EWaste", label: "E-Waste (In Yard)" },
                        { value: "EWasteOut", label: "E-Waste Out" },
                        { value: "Disposed", label: "Disposed" },
                        { value: "Lost", label: "Lost" },
                        { value: "Retained", label: "Retained" },
                        {
                          value: "Removed as MRN Cancelled",
                          label: "Removed as MRN Cancelled",
                        },
                      ],
                    },
                    {
                      key: "categoryHeadId",
                      label: "Category Head",
                      type: "select",
                      options: categoryHeads.map((head) => ({
                        value: head.id,
                        label: head.category_head_name,
                      })),
                    },
                    {
                      key: "categoryGroupId",
                      label: "Category Group",
                      type: "select",
                      options: categoryGroups.map((group) => ({
                        value: group.id,
                        label: group.category_group_name,
                      })),
                    },
                    {
                      key: "custodian_type",
                      label: "Custodian Type",
                      type: "select",
                      options: [
                        { value: "EMPLOYEE", label: "Employee" },
                        { value: "DIVISION", label: "Division" },
                        { value: "VEHICLE", label: "Vehicle" },
                      ],
                    },
                    {
                      key: "custodian_id",
                      label: "Custodian",
                      type: "select",
                      options: custodians.map((custodian) => ({
                        value: custodian.id,
                        label: `${custodian.id} - ${custodian.display_name}${
                          custodian.location ? ` (${custodian.location})` : ""
                        }`,
                      })),
                    },
                    { key: "stock_id", label: "Stock ID", type: "text" },
                  ]}
                  filters={filters}
                  onChange={(key, value) =>
                    setFilters((prev) => ({
                      ...prev,
                      [key]: value,
                      ...(key === "categoryHeadId"
                        ? { categoryGroupId: "" }
                        : {}),
                    }))
                  }
                  onReset={resetFilters}
                  onClose={closeFilterPanel}
                  isClosing={isClosing}
                />
              </div>
            )}
          </>
        }
        table={
          <ListTable
            data={rows}
            columns={columns}
            selectedRows={selected}
            onRowSelect={(id) =>
              setSelected((prev) =>
                prev.includes(id)
                  ? prev.filter((value) => value !== id)
                  : [...prev, id],
              )
            }
            idCol="id"
            onRowClick={(id) => navigate(`/asset/${id}/timeline`)}
            onLoadMore={loadMore}
            hasMore={hasMore}
            loading={isFetchingMore}
            virtualStartIndex={virtualStartIndex}
          />
        }
      />

      <Modal
        isOpen={dialog === "return"}
        onClose={() => setDialog(null)}
        title="Return"
      >
        <AssetReturnForm assetIds={selected} onDone={handleActionDone} />
      </Modal>

      <Modal
        isOpen={dialog === "transfer"}
        onClose={() => setDialog(null)}
        title="Transfer"
      >
        <AssetTransferForm assetIds={selected} onDone={handleActionDone} />
      </Modal>

      <Modal
        isOpen={dialog === "repairOut"}
        onClose={() => setDialog(null)}
        title="Repair Out"
      >
        <AssetRepairForm
          mode="out"
          assetIds={selected}
          onDone={handleActionDone}
        />
      </Modal>

      <Modal
        isOpen={dialog === "repairIn"}
        onClose={() => setDialog(null)}
        title="Repair In"
      >
        <AssetRepairForm
          mode="in"
          assetIds={selected}
          onDone={handleActionDone}
        />
      </Modal>

      <Modal
        isOpen={dialog === "finalize"}
        onClose={() => setDialog(null)}
        title="Dispose / Lost / E-Waste"
      >
        <AssetFinalizeForm assetIds={selected} onDone={handleActionDone} />
      </Modal>

      <Modal
        isOpen={dialog === "retain"}
        onClose={() => setDialog(null)}
        title="Retain"
      >
        <AssetRetainForm assetIds={selected} onDone={handleActionDone} />
      </Modal>

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ open: false, type: "success", message: "" })}
      />
    </>
  );
}
