import axios from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import PopupMessage from "@/components/PopupMessage";
import { STORE_API_BASE_URL } from "@/lib/api-config";

const API = STORE_API_BASE_URL;
const CUSTODIAN_TYPES = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "DIVISION", label: "Division" },
  { value: "VEHICLE", label: "Vehicle" },
];

function inferCustodianTypeFromId(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (text.startsWith("DIV-")) return "DIVISION";
  if (text.startsWith("VEH-")) return "VEHICLE";
  return "EMPLOYEE";
}

function normalizeAssetCustodian(asset) {
  const rawId =
    asset?.custodian_id ??
    (asset?.current_employee_id != null ? asset.current_employee_id : null);
  if (rawId == null || rawId === "") return null;
  const id = String(rawId).trim();
  if (!id) return null;
  const type =
    String(asset?.custodian_type || "").trim().toUpperCase() ||
    inferCustodianTypeFromId(id);
  return {
    id,
    type,
    employeeId:
      type === "EMPLOYEE" && Number.isFinite(Number(id)) ? Number(id) : null,
  };
}

export default function AssetTransferForm({ assetIds = [], onDone }) {
  const [employees, setEmployees] = useState([]);
  const [toType, setToType] = useState("EMPLOYEE");
  const [toEmployeeId, setToEmployeeId] = useState("");
  const [toCustodianId, setToCustodianId] = useState("");
  const [custodianOptions, setCustodianOptions] = useState([]);
  const [custodianLoading, setCustodianLoading] = useState(false);
  const [fromCustodian, setFromCustodian] = useState(null);
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
            const holders = picked.map(normalizeAssetCustodian).filter(Boolean);
            if (holders.length !== picked.length) {
              setValidationError(
                "Some selected assets do not have custody information."
              );
              return;
            }
            const uniqueKeys = Array.from(
              new Set(holders.map((h) => `${h.type}::${h.id}`))
            );
            if (uniqueKeys.length !== 1) {
              setValidationError(
                "All selected assets must belong to the same custodian to transfer."
              );
            } else {
              setFromCustodian(holders[0]);
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

  useEffect(() => {
    if (toType === "EMPLOYEE") {
      setCustodianOptions([]);
      setCustodianLoading(false);
      return;
    }
    let active = true;
    setCustodianLoading(true);
    axios
      .get(`${API}/custodians`, {
        params: { custodian_type: toType },
      })
      .then((r) => {
        if (!active) return;
        setCustodianOptions(r.data?.data || []);
      })
      .catch(() => {
        if (!active) return;
        setCustodianOptions([]);
      })
      .finally(() => {
        if (!active) return;
        setCustodianLoading(false);
      });
    return () => {
      active = false;
    };
  }, [toType]);

  const selectedCount = useMemo(() => assetIds?.length || 0, [assetIds]);
  const fromLabel = useMemo(() => {
    if (!fromCustodian) return "Not detected";
    return `${fromCustodian.type} | ${fromCustodian.id}`;
  }, [fromCustodian]);
  const resolvedToCustodian = useMemo(() => {
    if (toType === "EMPLOYEE") {
      const id = String(toEmployeeId || "").trim();
      if (!id) return null;
      return {
        id,
        type: "EMPLOYEE",
        employeeId: Number.isFinite(Number(id)) ? Number(id) : null,
      };
    }
    const id = String(toCustodianId || "").trim();
    if (!id) return null;
    return {
      id,
      type: toType,
      employeeId: null,
    };
  }, [toEmployeeId, toCustodianId, toType]);

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
    if (!fromCustodian) {
      return setPopup({
        open: true,
        type: "error",
        message: "Source custodian not detected",
      });
    }
    if (!resolvedToCustodian) {
      return setPopup({
        open: true,
        type: "error",
        message: "Please select target custodian",
      });
    }
    if (
      resolvedToCustodian.type === fromCustodian.type &&
      String(resolvedToCustodian.id) === String(fromCustodian.id)
    ) {
      return setPopup({
        open: true,
        type: "error",
        message: "Target custodian must be different from source",
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
      formData.append("fromCustodianId", String(fromCustodian.id));
      formData.append("fromCustodianType", String(fromCustodian.type));
      if (
        fromCustodian.type === "EMPLOYEE" &&
        Number.isFinite(Number(fromCustodian.id))
      ) {
        formData.append("fromEmployeeId", String(Number(fromCustodian.id)));
      }

      formData.append("toCustodianId", String(resolvedToCustodian.id));
      formData.append("toCustodianType", String(resolvedToCustodian.type));
      if (
        resolvedToCustodian.type === "EMPLOYEE" &&
        Number.isFinite(Number(resolvedToCustodian.id))
      ) {
        formData.append("toEmployeeId", String(Number(resolvedToCustodian.id)));
      }
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
      setToCustodianId("");
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
        <label className="text-sm font-medium">From Custodian</label>
        <select
          value={fromLabel}
          disabled
          className="border rounded p-2 w-full text-sm bg-gray-100 cursor-not-allowed"
        >
          <option value={fromLabel}>{fromLabel}</option>
        </select>
        {validationError && (
          <div className="text-xs text-red-600 mt-1">{validationError}</div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium">To Type</label>
        <select
          value={toType}
          onChange={(e) => {
            const nextType = e.target.value;
            setToType(nextType);
            setToEmployeeId("");
            setToCustodianId("");
          }}
          className="border rounded p-2 w-full text-sm"
        >
          {CUSTODIAN_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium">
          {toType === "EMPLOYEE"
            ? "To Employee"
            : toType === "DIVISION"
              ? "To Division"
              : "To Vehicle"}
        </label>
        {toType === "EMPLOYEE" ? (
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
                  {`${id} - ${name}`}
                </option>
              );
            })}
          </select>
        ) : (
          <select
            value={toCustodianId}
            onChange={(e) => setToCustodianId(e.target.value)}
            className="border rounded p-2 w-full text-sm"
          >
            <option value="">
              {custodianLoading
                ? "Loading..."
                : `Select ${toType.toLowerCase()}`}
            </option>
            {custodianOptions.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {`${c.id} - ${c.display_name}${c.location ? ` (${c.location})` : ""}`}
              </option>
            ))}
          </select>
        )}
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
