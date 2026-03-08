import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
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
import { useNavigate } from "react-router-dom";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";

const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

export default function Assets() {
  const navigate = useNavigate();

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
    employee_id: "",
    stock_id: "",
    from_date: "",
    to_date: "",
  });

  const [categoryHeads, setCategoryHeads] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [showFilters, setShowFilters] = useState(false);
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
      render: (_, r) => r.DayBook?.entry_no || "-",
    },
    {
      key: "item_category_id",
      label: "Category",
      render: (_, r) => r.ItemCategory?.category_name || "-",
    },

    {
      key: "vendor_id",
      label: "Vendor",
      render: (_, r) => r.Vendor?.name || "-",
    },
    { key: "status", label: "Status", chip: true, chipMap: statusChipMap },
    { key: "asset_tag", label: "Asset Tag" },
    { key: "serial_number", label: "Serial" },
    {
      key: "purchased_at",
      label: "Purchased",
      render: (v) => (v ? new Date(v).toLocaleDateString() : "-"),
    },
    {
      key: "warranty_expiry",
      label: "Warranty",
      render: (v) => (v ? new Date(v).toLocaleDateString() : "-"),
    },

    {
      key: "custodian_name",
      label: "Custodian",
      render: (_, row) => row.Employee?.name || "-",
    },
    {
      key: "custodian_id",
      label: "Custodian ID",
      render: (_, row) => row.Employee?.emp_id || row.current_employee_id || "-",
    },

    {
      key: "division",
      label: "Division",
      render: (_, r) => r.Employee?.division || "-",
    },
    { key: "notes", label: "Notes" },
  ];
  const fetchAssetsPage = useCallback(
    async ({ cursor, limit }) => {
      const res = await axios.get("http://localhost:3000/api/v1/assets/search", {
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
    refresh,
    virtualStartIndex,
  } = useCursorWindowedList({
    fetchPage: fetchAssetsPage,
    deps: [debouncedSearch, filters],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  /* ------------------ Effects ------------------ */
  useEffect(() => {
    setSelected([]);
  }, [debouncedSearch, filters]);

  useEffect(() => {
    axios
      .get("http://localhost:3000/api/v1/category-head")
      .then((res) => setCategoryHeads(res.data.data || []));
  }, []);

  useEffect(() => {
    if (!filters.categoryHeadId) {
      setCategoryGroups([]);
      return;
    }

    axios
      .get(
        `http://localhost:3000/api/v1/category-group/by-head/${filters.categoryHeadId}`,
      )
      .then((res) => setCategoryGroups(res.data.data || []));
  }, [filters.categoryHeadId]);

  useEffect(() => {
    axios
      .get("http://localhost:3000/api/v1/employee")
      .then((res) => setEmployees(res.data.data || []));
  }, []);

  /* ------------------ Actions ------------------ */
  const getSelectedAssets = () => {
    const rowById = new Map(rows.map((row) => [Number(row.id), row]));
    return selected.map((id) => rowById.get(Number(id))).filter(Boolean);
  };

  const listStatuses = (assets) =>
    [...new Set(assets.map((a) => a?.status || "Unknown"))].join(", ");

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
      const invalid = selectedAssets.filter((a) => !allowed.has(String(a.status)));
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
      const invalid = selectedAssets.filter((a) => blocked.has(String(a.status)));
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
    { label: "Dispose / Lost / E-Waste", onClick: () => openActionDialog("finalize") },
    { label: "Retain", onClick: () => openActionDialog("retain") },
  ];

  /* ------------------ Render ------------------ */
  return (
    <>
      <ListPage
        title="Assets"
        data={rows}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search asset tag / serial / employee / division..."
        searchValue={search}
        onSearch={setSearch}
        onFilter={() => setShowFilters((v) => !v)}
        actions={actions}
        showAdd={false}
        showUpdate={false}
        table={
          <ListTable
            data={rows}
            columns={columns}
            selectedRows={selected}
            onRowSelect={(id) =>
              setSelected((prev) =>
                prev.includes(id)
                  ? prev.filter((x) => x !== id)
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
        aboveContent={
          showFilters && (
            <div ref={filterRef} className="relative">
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
                    options: categoryHeads.map((h) => ({
                      value: h.id,
                      label: h.category_head_name,
                    })),
                  },
                  {
                    key: "categoryGroupId",
                    label: "Category Group",
                    type: "select",
                    options: categoryGroups.map((g) => ({
                      value: g.id,
                      label: g.category_group_name,
                    })),
                  },
                  {
                    key: "employee_id",
                    label: "Custodian",
                    type: "select",
                    options: employees.map((e) => ({
                      value: e.emp_id,
                      label: `${e.emp_id} - ${e.name}`,
                    })),
                  },
                  { key: "stock_id", label: "Stock ID", type: "text" },
                ]}
                filters={filters}
                onChange={(k, v) =>
                  setFilters((prev) => ({
                    ...prev,
                    [k]: v,
                    ...(k === "categoryHeadId" ? { categoryGroupId: "" } : {}),
                  }))
                }
                onReset={() => {
                  setFilters({
                    status: "",
                    categoryHeadId: "",
                    categoryGroupId: "",
                    employee_id: "",
                    stock_id: "",
                    from_date: "",
                    to_date: "",
                  });
                  setShowFilters(false);
                }}
                onClose={() => setShowFilters(false)}
              />
            </div>
          )
        }
      />

      {/* ------------------ Modals ------------------ */}
      <Modal
        isOpen={dialog === "return"}
        onClose={() => setDialog(null)}
        title="Return"
      >
        <AssetReturnForm
          assetIds={selected}
          onDone={handleActionDone}
        />
      </Modal>

      <Modal
        isOpen={dialog === "transfer"}
        onClose={() => setDialog(null)}
        title="Transfer"
      >
        <AssetTransferForm
          assetIds={selected}
          onDone={handleActionDone}
        />
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
        <AssetFinalizeForm
          assetIds={selected}
          onDone={handleActionDone}
        />
      </Modal>

      <Modal
        isOpen={dialog === "retain"}
        onClose={() => setDialog(null)}
        title="Retain"
      >
        <AssetRetainForm
          assetIds={selected}
          onDone={handleActionDone}
        />
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
