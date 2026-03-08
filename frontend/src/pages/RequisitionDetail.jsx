import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import PopupMessage from "@/components/PopupMessage";
import useDragToScroll from "@/hooks/useDragToScroll";
import logo from "/logo.svg";
import { DEFAULT_SKU_UNIT } from "@/constants/skuUnits";

const API = "http://localhost:3000/api/v1";

const FINAL_STATUSES = new Set([
  "Approved",
  "PartiallyApproved",
  "Rejected",
  "Cancelled",
  "Fulfilled",
]);
const STORE_MAP_STATUSES = new Set(["Approved", "PartiallyApproved", "Fulfilling"]);

const qty = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const formatQtyWithUnit = (value, unit) => `${qty(value)} ${unit || DEFAULT_SKU_UNIT}`;

const toWholeQty = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  if (!Number.isInteger(n)) return null;
  return n;
};

const toPositiveId = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN");
};

function getActionStyle(actionType) {
  const value = String(actionType || "")
    .toLowerCase()
    .replace(/\s+/g, "");

  const map = {
    create: { chip: "bg-green-100 text-green-700", dot: "bg-green-500" },
    submit: { chip: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
    approve: { chip: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
    forward: { chip: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500" },
    reject: { chip: "bg-red-100 text-red-700", dot: "bg-red-500" },
    qtyreduce: { chip: "bg-yellow-100 text-yellow-800", dot: "bg-yellow-500" },
    cancel: { chip: "bg-stone-200 text-stone-800", dot: "bg-stone-600" },
    fulfill: { chip: "bg-teal-100 text-teal-700", dot: "bg-teal-500" },
    mapitem: { chip: "bg-purple-100 text-purple-700", dot: "bg-purple-500" },
  };

  return (
    map[value] || {
      chip: "bg-gray-100 text-gray-700",
      dot: "bg-gray-400",
    }
  );
}

const ACTION_LABEL_MAP = {
  Create: "Created",
  Submit: "Submitted",
  Approve: "Approved",
  Forward: "Forwarded",
  Reject: "Rejected",
  QtyReduce: "Qty Reduced",
  Cancel: "Cancelled",
  Fulfill: "Fulfilled",
  MapItem: "Item Mapped",
};

function formatActionLabel(actionType) {
  const key = String(actionType || "");
  return ACTION_LABEL_MAP[key] || key || "-";
}

function humanizeKey(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function formatDetailValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ") || "-";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return String(value);
}

function buildActionDetails(action) {
  const payload = action?.payload_json;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];

  const details = [];
  const handled = new Set();
  const push = (label, value) => {
    if (value === undefined) return;
    details.push({ label, value: formatDetailValue(value) });
  };

  if (payload.forwarded_to !== undefined) {
    handled.add("forwarded_to");
    push("Forwarded To", payload.forwarded_to);
  }
  if (payload.next_status !== undefined) {
    handled.add("next_status");
    push("Next Status", payload.next_status);
  }
  if (payload.next_stage_role !== undefined) {
    handled.add("next_stage_role");
    push("Next Stage Role", payload.next_stage_role);
  }
  if (payload.next_stage_order !== undefined) {
    handled.add("next_stage_order");
    push("Next Stage Level", payload.next_stage_order);
  }
  if (payload.item_count !== undefined) {
    handled.add("item_count");
    push("Items Count", payload.item_count);
  }
  if (payload.status !== undefined) {
    handled.add("status");
    push("Requisition Status", payload.status);
  }
  if (payload.autoSubmit !== undefined) {
    handled.add("autoSubmit");
    push("Auto Submitted", payload.autoSubmit);
  }
  if (payload.requested_qty !== undefined) {
    handled.add("requested_qty");
    push("Requested Qty", payload.requested_qty);
  }
  if (payload.before_qty !== undefined) {
    handled.add("before_qty");
    push("Approved Qty (Before)", payload.before_qty);
  }
  if (payload.after_qty !== undefined) {
    handled.add("after_qty");
    push("Approved Qty (After)", payload.after_qty);
  }

  if (payload.before !== undefined) handled.add("before");
  if (payload.after !== undefined) handled.add("after");
  if (payload.before || payload.after) {
    const before = payload.before || {};
    const after = payload.after || {};
    const trackedFields = [
      ["item_category_id", "Category ID"],
      ["stock_id", "Stock ID"],
      ["sku_unit", "SKU Unit"],
      ["approved_qty", "Approved Qty"],
      ["item_status", "Item Status"],
      ["remarks", "Remarks"],
    ];

    trackedFields.forEach(([key, label]) => {
      if (before[key] !== undefined || after[key] !== undefined) {
        push(`Before ${label}`, before[key]);
        push(`After ${label}`, after[key]);
      }
    });
  }

  Object.entries(payload).forEach(([key, value]) => {
    if (handled.has(key)) return;
    if (value === null || value === undefined || typeof value === "object") return;
    push(humanizeKey(key), value);
  });

  return details;
}

const CARD_CLASS =
  "rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur";
const INPUT_CLASS =
  "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
const SELECT_CLASS =
  "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

const normalizeStockRows = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const id = row?.id ?? row?.stock_id ?? row?.stockId;
      const itemCategoryId =
        row?.item_category_id ?? row?.itemCategoryId ?? row?.category_id ?? null;
      const quantity = Number(
        row?.quantity ??
          row?.available_quantity ??
          row?.availableQty ??
          row?.available_qty ??
          0,
      );
      return {
        ...row,
        _id: toPositiveId(id),
        _item_category_id: toPositiveId(itemCategoryId),
        _qty: Number.isFinite(quantity) ? quantity : 0,
      };
    })
    .filter((row) => Number.isFinite(row?._id));

function buildAttachmentViewUrl(storedUrl) {
  if (!storedUrl) return "";
  const rel = String(storedUrl).replace(/^\/?uploads\//, "");
  return `http://localhost:3000/api/v1/view-image?path=${encodeURIComponent(rel)}`;
}

export default function RequisitionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [decisionByItem, setDecisionByItem] = useState({});
  const [itemCategories, setItemCategories] = useState([]);
  const [stocksByCategory, setStocksByCategory] = useState({});
  const [mappingByItem, setMappingByItem] = useState({});
  const [mappingSaving, setMappingSaving] = useState(false);
  const [printTimestamp, setPrintTimestamp] = useState("");
  const {
    containerRef: detailTableRef,
    onMouseDown: onDetailTableMouseDown,
    isDragging: isDetailTableDragging,
  } = useDragToScroll();
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
  });

  const roles = useMemo(() => JSON.parse(localStorage.getItem("roles") || "[]"), []);
  const normalizedRoles = useMemo(
    () => (Array.isArray(roles) ? roles.map((role) => String(role).toUpperCase()) : []),
    [roles],
  );

  const canAct = useMemo(() => {
    const stageRole = String(data?.current_stage_role || "").toUpperCase();
    if (!stageRole) return false;
    if (!normalizedRoles.length) return false;
    if (FINAL_STATUSES.has(String(data?.status || ""))) return false;
    return normalizedRoles.includes(stageRole);
  }, [data, normalizedRoles]);

  const canStoreMap = useMemo(() => {
    if (!STORE_MAP_STATUSES.has(String(data?.status || ""))) return false;
    return (
      normalizedRoles.includes("STORE_ENTRY") || normalizedRoles.includes("SUPER_ADMIN")
    );
  }, [data, normalizedRoles]);

  const missingMappingCount = useMemo(() => {
    let missing = 0;
    for (const item of data?.items || []) {
      if (["Rejected", "Cancelled", "Fulfilled"].includes(String(item?.item_status || ""))) {
        continue;
      }
      const remaining = Math.max(0, qty(item?.approved_qty) - qty(item?.issued_qty));
      if (remaining <= 0) continue;
      const draft = mappingByItem[item.id] || {
        item_category_id: item?.item_category_id ? String(item.item_category_id) : "",
        stock_id: item?.stock_id ? String(item.stock_id) : "",
      };
      if (!toPositiveId(draft.item_category_id) || !toPositiveId(draft.stock_id)) {
        missing += 1;
      }
    }
    return missing;
  }, [data, mappingByItem]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/requisitions/${id}`);
      const nextData = res.data?.data || null;
      setData(nextData);
      setRemarks("");
      setDecisionByItem({});
      const latestStoreRemarkMap = new Map();
      for (const action of nextData?.actions || []) {
        const itemId = toPositiveId(action?.requisition_item_id);
        const stageRole = String(
          action?.stage_role || action?.acted_by_role || "",
        ).toUpperCase();
        const remark = String(action?.remarks || "").trim();
        if (itemId && stageRole === "STORE_ENTRY" && remark) {
          latestStoreRemarkMap.set(itemId, remark);
        }
      }
      const nextMapping = {};
      for (const item of nextData?.items || []) {
        nextMapping[item.id] = {
          item_category_id: item?.item_category_id ? String(item.item_category_id) : "",
          stock_id: item?.stock_id ? String(item.stock_id) : "",
          approved_qty: String(item?.approved_qty ?? ""),
          remarks: latestStoreRemarkMap.get(item.id) || "",
        };
      }
      setMappingByItem(nextMapping);
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error?.response?.data?.message || "Failed to fetch requisition",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    axios
      .get(`${API}/itemCategories`)
      .then((res) => setItemCategories(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch(() => setItemCategories([]));
  }, []);

  useEffect(() => {
    const syncPrintTime = () => setPrintTimestamp(new Date().toLocaleString("en-IN"));
    syncPrintTime();
    window.addEventListener("beforeprint", syncPrintTime);
    return () => window.removeEventListener("beforeprint", syncPrintTime);
  }, []);

  const ensureStocksForCategory = useCallback(
    async (categoryId) => {
      const resolvedCategoryId = toPositiveId(categoryId);
      if (!resolvedCategoryId) return;
      if (stocksByCategory[resolvedCategoryId]) return;
      try {
        const res = await axios.get(`${API}/stock-items-all/${resolvedCategoryId}`, {
          params: {
            onlyInStock: true,
            groupByMaster: true,
          },
        });
        const normalized = normalizeStockRows(res.data?.data || []);
        setStocksByCategory((prev) => ({
          ...prev,
          [resolvedCategoryId]: normalized,
        }));
      } catch {
        setStocksByCategory((prev) => ({
          ...prev,
          [resolvedCategoryId]: [],
        }));
      }
    },
    [stocksByCategory],
  );

  useEffect(() => {
    const categoryIds = new Set();
    for (const item of data?.items || []) {
      const draft = mappingByItem[item.id] || {
        item_category_id: item?.item_category_id ? String(item.item_category_id) : "",
      };
      const categoryId = toPositiveId(draft.item_category_id);
      if (categoryId) categoryIds.add(categoryId);
    }
    categoryIds.forEach((categoryId) => {
      void ensureStocksForCategory(categoryId);
    });
  }, [data, mappingByItem, ensureStocksForCategory]);

  const upsertDecision = (itemId, patch) => {
    setDecisionByItem((prev) => ({
      ...prev,
      [itemId]: {
        action: prev[itemId]?.action || "approve",
        approved_qty:
          prev[itemId]?.approved_qty ?? data?.items?.find((x) => x.id === itemId)?.approved_qty,
        remarks: prev[itemId]?.remarks || "",
        ...patch,
      },
    }));
  };

  const buildDecisionsPayload = () => {
    const result = [];
    const invalidReduceQtyItems = [];
    for (const item of data?.items || []) {
      if (["Rejected", "Cancelled", "Fulfilled"].includes(item.item_status)) continue;
      const d = decisionByItem[item.id];
      if (!d) continue;
      if (d.action === "reduce") {
        const reducedQty = toWholeQty(d.approved_qty);
        if (reducedQty === null) {
          invalidReduceQtyItems.push(item.item_no || item.id);
          continue;
        }
      }
      result.push({
        requisition_item_id: item.id,
        action: d.action || "approve",
        approved_qty:
          d.action === "reduce"
            ? Number(d.approved_qty)
            : qty(item.approved_qty || item.requested_qty),
        remarks: d.remarks || null,
      });
    }
    return { decisions: result, invalidReduceQtyItems };
  };

  const upsertMapping = (itemId, patch) => {
    setMappingByItem((prev) => {
      const baseItem = data?.items?.find((row) => row.id === itemId);
      return {
        ...prev,
        [itemId]: {
          item_category_id:
            prev[itemId]?.item_category_id ||
            (baseItem?.item_category_id ? String(baseItem.item_category_id) : ""),
          stock_id:
            prev[itemId]?.stock_id ||
            (baseItem?.stock_id ? String(baseItem.stock_id) : ""),
          approved_qty:
            prev[itemId]?.approved_qty ?? String(baseItem?.approved_qty ?? ""),
          remarks: prev[itemId]?.remarks ?? "",
          ...patch,
        },
      };
    });
  };

  const handleStoreMappingSave = async () => {
    if (!canStoreMap) return;

    const pendingItems = (data?.items || []).filter((item) => {
      if (["Rejected", "Cancelled", "Fulfilled"].includes(String(item?.item_status || ""))) {
        return false;
      }
      const remaining = Math.max(0, qty(item?.approved_qty) - qty(item?.issued_qty));
      return remaining > 0;
    });

    if (pendingItems.length === 0) {
      setPopup({
        open: true,
        type: "info",
        message: "No pending requisition items require mapping.",
      });
      return;
    }

    const mappings = [];
    const missingItems = [];
    const invalidQtyItems = [];
    const nonWholeQtyItems = [];
    const missingQtyRemarksItems = [];

    for (const item of pendingItems) {
      const draft = mappingByItem[item.id] || {
        item_category_id: item?.item_category_id ? String(item.item_category_id) : "",
        stock_id: item?.stock_id ? String(item.stock_id) : "",
        approved_qty: String(item?.approved_qty ?? ""),
        remarks: "",
      };
      const itemCategoryId = toPositiveId(draft.item_category_id);
      const stockId = toPositiveId(draft.stock_id);
      if (!itemCategoryId || !stockId) {
        missingItems.push(item.item_no || item.id);
        continue;
      }

      const baseApprovedQty = qty(item?.approved_qty);
      const baseIssuedQty = qty(item?.issued_qty);
      const draftApprovedQty = toWholeQty(
        draft?.approved_qty === "" ||
          draft?.approved_qty === null ||
          draft?.approved_qty === undefined
          ? item?.approved_qty
          : draft.approved_qty,
      );
      if (draftApprovedQty === null) {
        nonWholeQtyItems.push(item.item_no || item.id);
        continue;
      }

      if (draftApprovedQty > baseApprovedQty + 0.0001) {
        invalidQtyItems.push(item.item_no || item.id);
        continue;
      }
      if (draftApprovedQty + 0.0001 < baseIssuedQty) {
        invalidQtyItems.push(item.item_no || item.id);
        continue;
      }

      const reduced = draftApprovedQty + 0.0001 < baseApprovedQty;
      const draftRemarks = String(draft?.remarks || "").trim();
      if (reduced && !draftRemarks) {
        missingQtyRemarksItems.push(item.item_no || item.id);
        continue;
      }

      mappings.push({
        requisition_item_id: item.id,
        item_category_id: itemCategoryId,
        stock_id: stockId,
        approved_qty: draftApprovedQty,
        remarks: draftRemarks || null,
      });
    }

    if (missingItems.length > 0) {
      setPopup({
        open: true,
        type: "error",
        message: `Complete mapping for item no: ${missingItems.join(", ")}`,
      });
      return;
    }

    if (invalidQtyItems.length > 0) {
      setPopup({
        open: true,
        type: "error",
        message: `Store can only reduce qty (and not below issued). Check item no: ${invalidQtyItems.join(", ")}`,
      });
      return;
    }

    if (nonWholeQtyItems.length > 0) {
      setPopup({
        open: true,
        type: "error",
        message: `Qty must be whole number (0, 1, 2...). Check item no: ${nonWholeQtyItems.join(", ")}`,
      });
      return;
    }

    if (missingQtyRemarksItems.length > 0) {
      setPopup({
        open: true,
        type: "error",
        message: `Remarks are required for reduced qty. Check item no: ${missingQtyRemarksItems.join(", ")}`,
      });
      return;
    }

    try {
      setMappingSaving(true);
      await axios.patch(`${API}/requisitions/${id}/map-items`, {
        mappings,
        requireComplete: true,
      });
      await fetchDetail();
      setPopup({
        open: true,
        type: "success",
        message: "Requisition item mapping saved successfully.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error?.response?.data?.message || "Failed to save item mapping",
      });
    } finally {
      setMappingSaving(false);
    }
  };

  const handleApprove = async () => {
    try {
      const { decisions, invalidReduceQtyItems } = buildDecisionsPayload();
      if (invalidReduceQtyItems.length > 0) {
        setPopup({
          open: true,
          type: "error",
          message: `Reduced qty must be whole number (0, 1, 2...). Check item no: ${invalidReduceQtyItems.join(", ")}`,
        });
        return;
      }

      setSubmitting(true);
      await axios.patch(`${API}/requisitions/${id}/approve`, {
        remarks: remarks || null,
        decisions,
      });
      await fetchDetail();
      setPopup({
        open: true,
        type: "success",
        message: "Requisition action submitted successfully.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error?.response?.data?.message || "Approval failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    try {
      setSubmitting(true);
      await axios.patch(`${API}/requisitions/${id}/reject`, {
        remarks: remarks || null,
      });
      await fetchDetail();
      setPopup({
        open: true,
        type: "success",
        message: "Requisition rejected successfully.",
      });
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message: error?.response?.data?.message || "Reject failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    setPrintTimestamp(new Date().toLocaleString("en-IN"));
    window.print();
  };

  if (loading) {
    return (
      <div className="px-2 py-3 sm:px-4 sm:py-4">
        <div className={CARD_CLASS}>
          <div className="text-sm text-slate-600">Loading requisition details...</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-3 h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back
        </button>
        <div className={CARD_CLASS}>
          Requisition not found.
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
        }
      `}</style>

      <div className="space-y-4 px-2 py-3 sm:px-4 sm:py-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>
          <div className="text-base font-semibold text-slate-800">
            Requisition Detail
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="ml-auto h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Print
          </button>
        </div>

        <div className={`grid grid-cols-1 gap-3 text-sm md:grid-cols-3 ${CARD_CLASS}`}>
          <div>
            <div className="text-xs text-slate-500">Req No.</div>
            <div className="font-semibold">{data.req_no}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Status</div>
            <div className="font-semibold">{data.status}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Current Stage</div>
            <div className="font-semibold">
              {data.current_stage_role
                ? `${data.current_stage_role} (L${data.current_stage_order ?? "-"})`
                : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Requester</div>
            <div className="font-semibold">{data.requester_name || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Employee ID</div>
            <div className="font-semibold">{data.requester_emp_id || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Division</div>
            <div className="font-semibold">{data.requester_division || "-"}</div>
          </div>
          <div className="md:col-span-3">
            <div className="text-xs text-slate-500">Purpose</div>
            <div className="font-medium">{data.purpose || "-"}</div>
          </div>
        </div>

        <div className="text-sm font-semibold text-slate-800">Requisition Items</div>

        <div
          ref={detailTableRef}
          onMouseDown={onDetailTableMouseDown}
          className={`overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm ${
            isDetailTableDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          <table className="min-w-[1560px] w-full text-sm text-slate-700">
            <thead className="bg-slate-50/90">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">S.No.</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Particulars</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">SKU Unit</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Qty Required</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Qty Approved</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Qty Issued</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Item Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Mapped Category</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Mapped Stock</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Store Qty</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Store Remarks</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Decision</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Decision Remarks</th>
              </tr>
            </thead>
            <tbody>
              {(data.items || []).map((item, idx) => {
                const draft = decisionByItem[item.id] || {
                  action: "approve",
                  approved_qty: item.approved_qty,
                  remarks: "",
                };
                const isTerminalItem = ["Rejected", "Cancelled", "Fulfilled"].includes(
                  item.item_status,
                );
                const decisionLocked = !canAct || isTerminalItem;
                const remainingQty = Math.max(0, qty(item?.approved_qty) - qty(item?.issued_qty));
                const mappingLocked = !canStoreMap || isTerminalItem || remainingQty <= 0;
                const mappingDraft = mappingByItem[item.id] || {
                  item_category_id: item?.item_category_id ? String(item.item_category_id) : "",
                  stock_id: item?.stock_id ? String(item.stock_id) : "",
                  approved_qty: String(item?.approved_qty ?? ""),
                  remarks: "",
                };
                const selectedCategoryId = toPositiveId(mappingDraft.item_category_id);
                const categoryStocks = selectedCategoryId
                  ? stocksByCategory[selectedCategoryId] || []
                  : [];
                return (
                  <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-50/70">
                    <td className="px-3 py-2">{item.item_no ?? idx + 1}</td>
                    <td className="px-3 py-2">{item.particulars}</td>
                    <td className="px-3 py-2">{item.sku_unit || DEFAULT_SKU_UNIT}</td>
                    <td className="px-3 py-2">
                      {formatQtyWithUnit(item.requested_qty, item.sku_unit)}
                    </td>
                    <td className="px-3 py-2">
                      {formatQtyWithUnit(item.approved_qty, item.sku_unit)}
                    </td>
                    <td className="px-3 py-2">
                      {formatQtyWithUnit(item.issued_qty, item.sku_unit)}
                    </td>
                    <td className="px-3 py-2">{item.item_status}</td>
                    <td className="px-3 py-2">
                      {mappingLocked ? (
                        item.item_category_name ||
                        (mappingDraft.item_category_id
                          ? `Category #${mappingDraft.item_category_id}`
                          : "-")
                      ) : (
                        <select
                          value={mappingDraft.item_category_id || ""}
                          onChange={(e) => {
                            const nextCategoryId = e.target.value;
                            upsertMapping(item.id, {
                              item_category_id: nextCategoryId,
                              stock_id: "",
                            });
                            if (nextCategoryId) {
                              void ensureStocksForCategory(nextCategoryId);
                            }
                          }}
                          className={`${SELECT_CLASS} min-w-[220px]`}
                        >
                          <option value="">Select category</option>
                          {itemCategories.map((category) => (
                            <option key={category.id} value={String(category.id)}>
                              {category.category_name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {mappingLocked ? (
                        item.stock_item_name ||
                        (mappingDraft.stock_id ? `Stock #${mappingDraft.stock_id}` : "-")
                      ) : (
                        <select
                          value={mappingDraft.stock_id || ""}
                          onFocus={() => {
                            if (mappingDraft.item_category_id) {
                              void ensureStocksForCategory(mappingDraft.item_category_id);
                            }
                          }}
                          onChange={(e) =>
                            upsertMapping(item.id, { stock_id: e.target.value })
                          }
                          disabled={!mappingDraft.item_category_id}
                          className={`${SELECT_CLASS} min-w-[280px] disabled:bg-slate-100`}
                        >
                          <option value="">
                            {mappingDraft.item_category_id
                              ? "Select stock"
                              : "Select category first"}
                          </option>
                          {categoryStocks.map((stock) => (
                            <option key={stock._id} value={String(stock._id)}>
                              {(stock.item_name || stock.name || `Stock #${stock._id}`) +
                                ` (${stock._qty} ${stock.sku_unit || DEFAULT_SKU_UNIT})`}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {mappingLocked ? (
                        formatQtyWithUnit(item.approved_qty, item.sku_unit)
                      ) : (
                        <input
                          type="number"
                          min={Math.max(0, Math.ceil(qty(item?.issued_qty)))}
                          max={Math.max(0, Math.floor(qty(item?.approved_qty)))}
                          step="1"
                          value={mappingDraft.approved_qty}
                          onChange={(e) =>
                            upsertMapping(item.id, { approved_qty: e.target.value })
                          }
                          className={`${INPUT_CLASS} w-28`}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {mappingLocked ? (
                        <span className="text-slate-600">{mappingDraft.remarks || "-"}</span>
                      ) : (
                        <input
                          value={mappingDraft.remarks || ""}
                          onChange={(e) =>
                            upsertMapping(item.id, { remarks: e.target.value })
                          }
                          className={`${INPUT_CLASS} min-w-[240px]`}
                          placeholder="Store remark (required if qty reduced)"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <select
                          disabled={decisionLocked}
                          value={draft.action}
                          onChange={(e) =>
                            upsertDecision(item.id, { action: e.target.value })
                          }
                          className={SELECT_CLASS}
                        >
                          <option value="approve">Approve</option>
                          <option value="reduce">Reduce Qty</option>
                          <option value="reject">Reject</option>
                        </select>
                        {draft.action === "reduce" && (
                          <input
                            type="number"
                            min="0"
                            max={Math.max(0, Math.floor(qty(item?.approved_qty)))}
                            step="1"
                            disabled={decisionLocked}
                            value={draft.approved_qty}
                            onChange={(e) =>
                              upsertDecision(item.id, {
                                approved_qty: e.target.value,
                              })
                            }
                            className={`${INPUT_CLASS} w-24`}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        disabled={decisionLocked}
                        value={draft.remarks}
                        onChange={(e) =>
                          upsertDecision(item.id, { remarks: e.target.value })
                        }
                        className={`${INPUT_CLASS} w-full`}
                        placeholder="Optional"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={CARD_CLASS}>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Action Remarks
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-300 bg-white p-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            placeholder="Optional remarks"
          />
          {canAct && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={handleApprove}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Saving..." : "Approve / Forward"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleReject}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reject Requisition
              </button>
            </div>
          )}
          {canStoreMap && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={mappingSaving}
                onClick={handleStoreMappingSave}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mappingSaving ? "Saving Mapping..." : "Save Item Mapping"}
              </button>
              <span className="text-xs text-slate-600">
                {missingMappingCount > 0
                  ? `${missingMappingCount} pending item(s) are not mapped yet.`
                  : "All pending items are mapped."}
              </span>
              <span className="text-xs text-slate-600">
                Store can only reduce qty (not increase). Remarks required for reduced qty.
              </span>
            </div>
          )}
        </div>

        <div className={CARD_CLASS}>
          <div className="mb-2 text-sm font-semibold text-slate-700">Attachments</div>
          {(data.attachments || []).length === 0 ? (
            <div className="text-sm text-slate-500">No attachments.</div>
          ) : (
            <div className="space-y-2">
              {(data.attachments || []).map((attachment) => (
                <a
                  key={attachment.id}
                  href={buildAttachmentViewUrl(attachment.file_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm text-sky-700 underline"
                >
                  {attachment.file_name || `Attachment #${attachment.id}`}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-semibold text-slate-700">Action Timeline</div>
            <div className="text-xs text-slate-500">
              All approval/store remarks are shown in timeline entries below.
            </div>
          </div>
          {(data.actions || []).length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-500">No actions yet.</div>
          ) : (
            <div className="relative px-4 pb-0 pl-10 pt-4">
              <div className="absolute bottom-0 left-6 top-4 w-px bg-slate-200" />

              {(data.actions || []).map((action, idx) => {
                const style = getActionStyle(action.action);
                const item = (data.items || []).find(
                  (entry) => Number(entry.id) === Number(action.requisition_item_id),
                );
                const actionDetails = buildActionDetails(action);

                return (
                  <div key={action.id || `${action.action}-${idx}`} className="relative mb-4 last:mb-0">
                    <span
                      className={`absolute -left-[1.1rem] top-5 h-3 w-3 rounded-full border-2 border-white ${style.dot}`}
                    />

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style.chip}`}
                        >
                          {formatActionLabel(action.action)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDateTime(action.action_at)}
                        </span>
                      </div>

                      <div className="my-3 h-px bg-slate-200" />

                      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            By
                          </div>
                          <div className="mt-1 text-slate-800">
                            {action.acted_by_name || action.acted_by_user_id || "-"}
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            Role / Stage
                          </div>
                          <div className="mt-1 text-slate-800">
                            {action.stage_role
                              ? `${action.stage_role} (L${action.stage_order ?? "-"})`
                              : action.acted_by_role || "-"}
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            Item No.
                          </div>
                          <div className="mt-1 text-slate-800">
                            {item?.item_no
                              ? String(item.item_no)
                              : action.requisition_item_id
                                ? `#${action.requisition_item_id}`
                                : "-"}
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            Action ID
                          </div>
                          <div className="mt-1 text-slate-800">
                            {action.id ?? "-"}
                          </div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-3 md:col-span-2">
                          <div className="text-xs uppercase tracking-wide text-slate-500">
                            Remarks
                          </div>
                          <div className="mt-1 text-slate-800">
                            {action.remarks || "No remarks"}
                          </div>
                        </div>

                        {actionDetails.length > 0 ? (
                          <div className="rounded-lg border border-slate-200 bg-white p-3 md:col-span-2">
                            <div className="text-xs uppercase tracking-wide text-slate-500">
                              What Changed
                            </div>
                            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                              {actionDetails.map((detail, detailIndex) => (
                                <div
                                  key={`${action.id || idx}-detail-${detailIndex}`}
                                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2"
                                >
                                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                                    {detail.label}
                                  </div>
                                  <div className="mt-0.5 text-xs text-slate-800">
                                    {detail.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="hidden print:block text-black">
        <header className="mb-4 border-b border-black pb-3 text-center">
          <img src={logo} alt="Company Logo" className="mx-auto mb-2 h-16 w-auto" />
          <h1 className="text-xl font-bold">
            Haryana State Electronics Development Co-operation Ltd.
          </h1>
          <p className="text-sm">(Haryana Government Undertaking)</p>
          <p className="text-sm">S.C.O. 111-113, Sector-17-B, Chandigarh - 160017</p>
        </header>

        <h2 className="mb-3 text-center text-lg font-semibold">Digital Requisition</h2>

        <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <div>
            <strong>Req No:</strong> {data.req_no || "-"}
          </div>
          <div>
            <strong>Status:</strong> {data.status || "-"}
          </div>
          <div>
            <strong>Requester:</strong> {data.requester_name || "-"}
          </div>
          <div>
            <strong>Employee ID:</strong> {data.requester_emp_id || "-"}
          </div>
          <div>
            <strong>Division:</strong> {data.requester_division || "-"}
          </div>
          <div>
            <strong>Current Stage:</strong>{" "}
            {data.current_stage_role
              ? `${data.current_stage_role} (L${data.current_stage_order ?? "-"})`
              : "-"}
          </div>
          <div className="col-span-2">
            <strong>Purpose:</strong> {data.purpose || "-"}
          </div>
          <div>
            <strong>Submitted At:</strong> {formatDateTime(data.submitted_at)}
          </div>
          <div>
            <strong>Printed At:</strong> {printTimestamp || formatDateTime(new Date())}
          </div>
        </div>

        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-1 text-left">S.No.</th>
              <th className="border border-black p-1 text-left">Particulars</th>
              <th className="border border-black p-1 text-left">SKU Unit</th>
              <th className="border border-black p-1 text-left">Qty Required</th>
              <th className="border border-black p-1 text-left">Qty Approved</th>
              <th className="border border-black p-1 text-left">Qty Issued</th>
              <th className="border border-black p-1 text-left">Item Status</th>
              <th className="border border-black p-1 text-left">Mapped Category</th>
              <th className="border border-black p-1 text-left">Mapped Stock</th>
              <th className="border border-black p-1 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {(data.items || []).map((item, idx) => (
              <tr key={item.id}>
                <td className="border border-black p-1">{item.item_no ?? idx + 1}</td>
                <td className="border border-black p-1">{item.particulars || "-"}</td>
                <td className="border border-black p-1">{item.sku_unit || DEFAULT_SKU_UNIT}</td>
                <td className="border border-black p-1">
                  {formatQtyWithUnit(item.requested_qty, item.sku_unit)}
                </td>
                <td className="border border-black p-1">
                  {formatQtyWithUnit(item.approved_qty, item.sku_unit)}
                </td>
                <td className="border border-black p-1">
                  {formatQtyWithUnit(item.issued_qty, item.sku_unit)}
                </td>
                <td className="border border-black p-1">{item.item_status || "-"}</td>
                <td className="border border-black p-1">{item.item_category_name || "-"}</td>
                <td className="border border-black p-1">{item.stock_item_name || "-"}</td>
                <td className="border border-black p-1">{item.remarks || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 grid grid-cols-2 gap-10 text-sm">
          <div>
            <div className="mb-8 border-b border-black" />
            <p>Requester Signature</p>
          </div>
          <div>
            <div className="mb-8 border-b border-black" />
            <p>Store Verification Signature</p>
          </div>
        </div>
      </div>

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
}
