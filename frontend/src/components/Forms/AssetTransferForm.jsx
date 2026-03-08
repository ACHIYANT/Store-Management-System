import axios from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import PopupMessage from "@/components/PopupMessage";

const API = "http://localhost:3000/api/v1";

export default function AssetTransferForm({ assetIds = [], onDone }) {
  const [employees, setEmployees] = useState([]);
  const [fromId, setFromId] = useState(""); // auto-filled, non-editable
  const [toEmployeeId, setToEmployeeId] = useState("");
  const [notes, setNotes] = useState("");
  const [approvalFile, setApprovalFile] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "", message: "" });
  const [loading, setLoading] = useState(true);
  const [validationError, setValidationError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [empRes, assetsRes] = await Promise.all([
          axios.get(`${API}/employee`),
          axios.get(`${API}/assets`),
        ]);
        if (!mounted) return;
        setEmployees(empRes.data?.data || empRes.data || []);
        const allAssets = assetsRes.data?.data || assetsRes.data || [];

        // Validate selected assets are all currently issued and share the same holder
        const picked = allAssets.filter((a) =>
          assetIds.includes(a.id || a.asset_id)
        );
        if (assetIds.length === 0) {
          setValidationError("No assets selected.");
        } else if (picked.length !== assetIds.length) {
          setValidationError("Some selected assets were not found.");
        } else {
          const notIssued = picked.filter((a) => String(a.status) !== "Issued");
          if (notIssued.length > 0) {
            setValidationError(
              "Transfer allowed only for assets that are currently Issued."
            );
          } else {
            const holderIds = picked
              .map((a) => a.current_employee_id)
              .filter(Boolean);
            const uniqueHolders = Array.from(new Set(holderIds));
            if (uniqueHolders.length !== 1 || !uniqueHolders[0]) {
              setValidationError(
                "All selected assets must belong to the same employee to transfer."
              );
            } else {
              setFromId(String(uniqueHolders[0])); // preselect and lock
              setValidationError("");
            }
          }
        }
      } catch {
        setValidationError("Failed to load employees/assets.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [assetIds]);

  const selectedCount = useMemo(() => assetIds?.length || 0, [assetIds]);

  const submit = async () => {
    if (submitting) return;
    if (validationError) {
      return setPopup({ open: true, type: "error", message: validationError });
    }
    if (!assetIds.length) {
      return setPopup({
        open: true,
        type: "error",
        message: "No assets selected",
      });
    }
    if (!fromId) {
      return setPopup({
        open: true,
        type: "error",
        message: "Source employee not detected",
      });
    }
    if (!toEmployeeId) {
      return setPopup({
        open: true,
        type: "error",
        message: "Please select target employee",
      });
    }
    if (String(toEmployeeId) === String(fromId)) {
      return setPopup({
        open: true,
        type: "error",
        message: "Target employee must be different from source",
      });
    }
    if (!approvalFile) {
      return setPopup({
        open: true,
        type: "error",
        message: "Approval document is required.",
      });
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("assetIds", JSON.stringify(assetIds));
      formData.append("fromEmployeeId", String(Number(fromId)));
      formData.append("toEmployeeId", String(Number(toEmployeeId)));
      if (notes) formData.append("notes", notes);
      formData.append("entry_no", "ASSET-TRANSFER");
      formData.append("bill_no", `${Date.now()}-${selectedCount}`);
      formData.append("file", approvalFile);

      await axios.patch(
        `${API}/assets/transfer`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setPopup({
        open: true,
        type: "success",
        message: `Transferred ${selectedCount} asset(s)`,
      });
      setToEmployeeId("");
      setNotes("");
      setApprovalFile(null);
    } catch (e) {
      setPopup({
        open: true,
        type: "error",
        message: e?.response?.data?.message || e.message || "Transfer failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePopupClose = () => {
    const wasSuccess = popup.type === "success";
    setPopup({ open: false, type: "", message: "" });
    if (wasSuccess) onDone?.(true);
  };

  if (loading) {
    return <div className="text-sm text-gray-600">Loading...</div>;
  }

  return (
    <div className="grid gap-3">
      <div className="text-xs text-gray-600">
        Selected assets: <b>{selectedCount}</b>
      </div>

      {/* From (auto-selected, non-editable) */}
      <div>
        <label className="text-sm font-medium">From Employee</label>
        <select
          value={fromId || ""}
          disabled
          className="border rounded p-2 w-full text-sm bg-gray-100 cursor-not-allowed"
        >
          <option value="">{fromId ? "Detected" : "Not detected"}</option>
          {employees.map((e) => {
            const id = String(e.emp_id || e.id);
            const name = e.name || `Employee ${id}`;
            return (
              <option key={id} value={id}>
                {name}
              </option>
            );
          })}
        </select>
        {validationError && (
          <div className="text-xs text-red-600 mt-1">{validationError}</div>
        )}
      </div>

      {/* To (required) */}
      <div>
        <label className="text-sm font-medium">To Employee</label>
        <select
          value={toEmployeeId}
          onChange={(e) => setToEmployeeId(e.target.value)}
          className="border rounded p-2 w-full text-sm"
        >
          <option value="">Select employee</option>
          {employees.map((e) => {
            const id = String(e.emp_id || e.id);
            const name = e.name || `Employee ${id}`;
            return (
              <option key={id} value={id}>
                {name}
              </option>
            );
          })}
        </select>
      </div>

      <Textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="grid gap-1">
        <label className="text-xs text-gray-700 font-medium">
          Noting Approval <span className="text-red-600">*</span>
        </label>
        <input
          type="file"
          onChange={(e) => setApprovalFile(e.target.files?.[0] || null)}
          className="border rounded p-2 text-sm"
        />
      </div>

      <Button onClick={submit} disabled={!!validationError || submitting}>
        {submitting ? "Please wait..." : "Confirm Transfer"}
      </Button>

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={handlePopupClose}
      />
    </div>
  );
}
