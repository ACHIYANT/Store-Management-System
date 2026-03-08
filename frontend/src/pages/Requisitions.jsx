import { useMemo, useState } from "react";
import axios from "axios";
import TopBar from "@/components/TopBar";
import PopupMessage from "@/components/PopupMessage";
import useDragToScroll from "@/hooks/useDragToScroll";
import { SKU_UNITS, DEFAULT_SKU_UNIT } from "@/constants/skuUnits";

const API = "http://localhost:3000/api/v1";

function emptyItem(itemNo) {
  return {
    item_no: itemNo,
    particulars: "",
    sku_unit: DEFAULT_SKU_UNIT,
    requested_qty: "",
    remarks: "",
  };
}

export default function Requisitions() {
  const [purpose, setPurpose] = useState("");
  const [remarks, setRemarks] = useState("");
  const [itemsDraft, setItemsDraft] = useState([emptyItem(1)]);
  const [creating, setCreating] = useState(false);
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
  });
  const {
    containerRef: draftTableRef,
    onMouseDown: onDraftTableMouseDown,
    isDragging: isDraftTableDragging,
  } = useDragToScroll();

  const addItemRow = () => {
    setItemsDraft((prev) => [...prev, emptyItem(prev.length + 1)]);
  };

  const removeItemRow = (idx) => {
    setItemsDraft((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((item, i) => ({ ...item, item_no: i + 1 })),
    );
  };

  const updateItemRow = (idx, key, value) => {
    setItemsDraft((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)),
    );
  };

  const validItems = useMemo(
    () =>
      itemsDraft
        .map((item) => ({
          item_no: Number(item.item_no) || 0,
          particulars: String(item.particulars || "").trim(),
          requested_qty: Number(item.requested_qty),
          sku_unit: item.sku_unit || DEFAULT_SKU_UNIT,
          remarks: item.remarks || null,
        }))
        .filter(
          (item) =>
            item.item_no > 0 &&
            item.particulars &&
            Number.isFinite(item.requested_qty) &&
            item.requested_qty > 0,
        ),
    [itemsDraft],
  );

  const submitRequisition = async () => {
    if (!validItems.length) {
      setPopup({
        open: true,
        type: "error",
        message: "Add at least one valid item (particulars + qty required).",
      });
      return;
    }

    try {
      setCreating(true);
      await axios.post(`${API}/requisitions`, {
        purpose: purpose || null,
        remarks: remarks || null,
        items: validItems,
        autoSubmit: true,
      });

      setPopup({
        open: true,
        type: "success",
        message:
          "Requisition created and submitted successfully. Track it in Requisition Queue and Requisition History.",
      });
      setPurpose("");
      setRemarks("");
      setItemsDraft([emptyItem(1)]);
    } catch (error) {
      setPopup({
        open: true,
        type: "error",
        message:
          error?.response?.data?.message || "Failed to create requisition",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="min-w-0 px-2 py-3 sm:px-4 sm:py-4 lg:px-5">
        <TopBar
          title="My Requisitions"
          showSearch={false}
          showAdd={false}
          showUpdate={false}
          showFilter={false}
        />

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
          <div className="mb-3 text-sm font-semibold text-slate-800">
            Create Digital Requisition
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Purpose
              </label>
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="Purpose of requisition"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Header Remarks
              </label>
              <input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="Optional remarks"
              />
            </div>
          </div>

          <div
            ref={draftTableRef}
            onMouseDown={onDraftTableMouseDown}
            className={`mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm ${
              isDraftTableDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            <table className="min-w-[760px] w-full text-sm">
              <thead className="bg-slate-50/90">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">S.No.</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Particulars</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Qty. Required</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">SKU Unit</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Qty. Recorded</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Remarks</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {itemsDraft.map((item, idx) => (
                  <tr key={idx} className="border-t border-slate-200 hover:bg-slate-50/60">
                    <td className="px-3 py-2">{item.item_no ?? idx + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        value={item.particulars}
                        onChange={(e) =>
                          updateItemRow(idx, "particulars", e.target.value)
                        }
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        placeholder="Item particulars"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={item.requested_qty}
                        onChange={(e) =>
                          updateItemRow(idx, "requested_qty", e.target.value)
                        }
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={item.sku_unit || DEFAULT_SKU_UNIT}
                        onChange={(e) =>
                          updateItemRow(idx, "sku_unit", e.target.value)
                        }
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      >
                        {SKU_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-slate-500">-</td>
                    <td className="px-3 py-2">
                      <input
                        value={item.remarks}
                        onChange={(e) => updateItemRow(idx, "remarks", e.target.value)}
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                        placeholder="Optional item remarks"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={itemsDraft.length <= 1}
                        className="h-8 rounded-md border border-rose-200 bg-rose-50 px-2.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addItemRow}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              + Add Row
            </button>
            <button
              type="button"
              onClick={submitRequisition}
              disabled={creating}
              className="h-9 rounded-md bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "Submitting..." : "Submit Requisition"}
            </button>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            Track submitted requisitions in Requisition Queue and Requisition
            History.
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
