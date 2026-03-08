import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import Modal from "@/components/Modal";
import PopupMessage from "@/components/PopupMessage";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:3000/api/v1";
const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

const STATUS_CHIPS = {
  EWaste: { color: "yellow", emoji: "♻️" },
  EWasteOut: { color: "indigo", emoji: "🚛" },
};

const DEFAULT_FORM = {
  vendorName: "",
  vendorAddress: "",
  notes: "",
  issuedEmpId: "",
  issuedName: "Store Incharge",
  issuedDesignation: "Store Incharge",
  issuedDivision: "",
};

export default function EWasteItems() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState([]);
  const [status, setStatus] = useState("EWaste");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [serverTotal, setServerTotal] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [popup, setPopup] = useState({
    open: false,
    type: "success",
    message: "",
    moveTo: "",
  });

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

  const {
    rows,
    loading,
    isFetchingMore,
    hasMore,
    loadMore,
    refresh,
    virtualStartIndex,
  } = useCursorWindowedList({
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
      label: "Purchase Vendor",
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
  ];

  const selectedAssets = useMemo(() => {
    const byId = new Map(rows.map((row) => [Number(row.id), row]));
    return selected.map((id) => byId.get(Number(id))).filter(Boolean);
  }, [rows, selected]);

  const openCreatePass = () => {
    if (!selected.length) {
      setPopup({
        open: true,
        type: "error",
        message: "Select at least one E-Waste asset first.",
        moveTo: "",
      });
      return;
    }

    if (selectedAssets.length !== selected.length) {
      setPopup({
        open: true,
        type: "error",
        message: "Some selected assets are not loaded currently. Refresh and try again.",
        moveTo: "",
      });
      return;
    }

    const invalid = selectedAssets.filter((asset) => String(asset.status) !== "EWaste");
    if (invalid.length) {
      setPopup({
        open: true,
        type: "error",
        message: "Only assets in EWaste status can be included in E-Waste gate pass.",
        moveTo: "",
      });
      return;
    }

    setForm(DEFAULT_FORM);
    setShowCreateDialog(true);
  };

  const createPass = async () => {
    if (submitting) return;
    if (!form.vendorName.trim() || !form.vendorAddress.trim()) {
      setPopup({
        open: true,
        type: "error",
        message: "Vendor representative name and address are required.",
        moveTo: "",
      });
      return;
    }

    try {
      setSubmitting(true);
      const createdBy =
        localStorage.getItem("fullname") ||
        localStorage.getItem("username") ||
        "System User";

      const res = await axios.post(`${API}/gate-passes/e-waste`, {
        assetIds: selected,
        notes: form.notes || null,
        createdBy,
        vendorSignatoryName: form.vendorName,
        vendorSignatoryAddress: form.vendorAddress,
        issuedSignatoryEmpId: form.issuedEmpId || null,
        issuedSignatoryName: form.issuedName || null,
        issuedSignatoryDesignation: form.issuedDesignation || null,
        issuedSignatoryDivision: form.issuedDivision || null,
      });

      const gatePass = res?.data?.data || null;
      setShowCreateDialog(false);
      setSelected([]);
      refresh();
      setPopup({
        open: true,
        type: "success",
        message: gatePass?.pass_no
          ? `E-Waste gate pass ${gatePass.pass_no} created successfully.`
          : "E-Waste gate pass created successfully.",
        moveTo: gatePass?.id ? `/gate-pass/${gatePass.id}` : "",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to create E-Waste gate pass.",
        moveTo: "",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const actions = [{ label: "Create E-Waste Gate Pass", onClick: openCreatePass }];

  return (
    <>
      <ListPage
        title="E-Waste Assets"
        data={rows}
        loading={loading}
        searchValue={search}
        onSearch={setSearch}
        searchPlaceholder="Search by asset tag, serial, category, employee..."
        showAdd={false}
        showUpdate={false}
        showFilter={false}
        actions={actions}
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
                <option value="EWaste">E-Waste (In Yard)</option>
                <option value="EWasteOut">E-Waste Out</option>
              </select>
            </div>
          </div>
        }
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

      <Modal
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        title="Create E-Waste Gate Pass"
      >
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-slate-600">Vendor Representative Name</label>
            <input
              className="mt-1 w-full border rounded p-2 h-10"
              value={form.vendorName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, vendorName: e.target.value }))
              }
              placeholder="Enter vendor representative name"
            />
          </div>

          <div>
            <label className="text-xs text-slate-600">Vendor Representative Address</label>
            <textarea
              className="mt-1 w-full border rounded p-2 min-h-20"
              value={form.vendorAddress}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, vendorAddress: e.target.value }))
              }
              placeholder="Enter vendor address"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-600">Issued Signatory Emp ID</label>
              <input
                className="mt-1 w-full border rounded p-2 h-10"
                value={form.issuedEmpId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, issuedEmpId: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Issued Signatory Name</label>
              <input
                className="mt-1 w-full border rounded p-2 h-10"
                value={form.issuedName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, issuedName: e.target.value }))
                }
                placeholder="Store Incharge"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Designation</label>
              <input
                className="mt-1 w-full border rounded p-2 h-10"
                value={form.issuedDesignation}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, issuedDesignation: e.target.value }))
                }
                placeholder="Store Incharge"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Division</label>
              <input
                className="mt-1 w-full border rounded p-2 h-10"
                value={form.issuedDivision}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, issuedDivision: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-600">Notes</label>
            <textarea
              className="mt-1 w-full border rounded p-2 min-h-20"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional notes"
            />
          </div>

          <div className="text-xs text-slate-500">
            Selected assets: <b>{selected.length}</b>
          </div>

          <button
            type="button"
            className="w-full rounded bg-slate-900 text-white py-2 text-sm disabled:opacity-60"
            onClick={createPass}
            disabled={submitting}
          >
            {submitting ? "Creating..." : "Create Gate Pass"}
          </button>
        </div>
      </Modal>

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        moveTo={popup.moveTo}
        onClose={() =>
          setPopup({
            open: false,
            type: "success",
            message: "",
            moveTo: "",
          })
        }
      />
    </>
  );
}
