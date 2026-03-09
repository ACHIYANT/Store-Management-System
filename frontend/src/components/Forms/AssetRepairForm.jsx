import axios from "axios";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useMemo, useRef } from "react";
import PopupMessage from "@/components/PopupMessage";
import { useNavigate } from "react-router-dom";
import { STORE_API_BASE_URL } from "@/lib/api-config";

const API = STORE_API_BASE_URL;

export default function AssetRepairForm({
  mode = "out",
  assetIds = [],
  onDone,
}) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [approvalFile, setApprovalFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [gatePass, setGatePass] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "", message: "" });
  const fileInputRef = useRef(null);

  const selectedCount = useMemo(() => assetIds?.length || 0, [assetIds]);
  const isOut = mode === "out";
  const url = isOut ? `${API}/assets/repair-out` : `${API}/assets/repair-in`;
  const btnText = isOut ? "Confirm Repair Out" : "Confirm Repair In";
  const successText = isOut ? "Sent to repair" : "Received from repair";

  const submit = async () => {
    if (submitting) return;
    if (!assetIds.length) {
      return setPopup({
        open: true,
        type: "error",
        message: "No assets selected",
      });
    }
    if (isOut && !approvalFile) {
      return setPopup({
        open: true,
        type: "error",
        message: "Approval document is required for Repair Out.",
      });
    }
    try {
      setSubmitting(true);
      let res;
      if (isOut) {
        const formData = new FormData();
        formData.append("assetIds", JSON.stringify(assetIds));
        if (notes) formData.append("notes", notes);
        formData.append(
          "createdBy",
          localStorage.getItem("fullname") || "System User",
        );
        formData.append("entry_no", "ASSET-REPAIR-OUT");
        formData.append("bill_no", `${Date.now()}-${selectedCount}`);
        formData.append("file", approvalFile);
        res = await axios.patch(url, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        res = await axios.patch(
          url,
          {
            assetIds,
            notes,
            createdBy: localStorage.getItem("fullname") || "System User",
          },
          { headers: { "Content-Type": "application/json" } },
        );
      }

      const generatedGatePass = res?.data?.data?.gatePass || null;
      if (isOut) {
        setGatePass(generatedGatePass);
      } else {
        setGatePass(null);
      }

      setPopup({
        open: true,
        type: "success",
        message: `${successText} (${selectedCount} asset${
          selectedCount > 1 ? "s" : ""
        })${
          isOut && generatedGatePass?.pass_no
            ? ` | Gate Pass: ${generatedGatePass.pass_no}`
            : ""
        }`,
      });
      setNotes("");
      if (isOut) {
        setApprovalFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    } catch (e) {
      setGatePass(null);
      setPopup({
        open: true,
        type: "error",
        message: e?.response?.data?.message || e.message || "Operation failed.",
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

  return (
    <div className="grid gap-3">
      <div className="text-xs text-gray-600">
        Selected assets: <b>{selectedCount}</b>
      </div>

      <Textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {isOut && (
        <div className="grid gap-1">
          <label className="text-xs text-gray-700 font-medium">
            Noting Approval <span className="text-red-600">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => setApprovalFile(e.target.files?.[0] || null)}
            className="border rounded p-2 text-sm"
          />
        </div>
      )}

      <Button onClick={submit} disabled={submitting}>
        {submitting ? "Please wait..." : btnText}
      </Button>

      {isOut && gatePass?.id && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
          <div className="font-medium text-blue-900">
            Gate pass generated: {gatePass.pass_no}
          </div>
          <div className="text-blue-800 text-xs mt-1">
            Share/print this pass and verify at the gate before repair-in.
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              onClick={() => navigate(`/gate-pass/${gatePass.id}`)}
            >
              Open Gate Pass
            </Button>
            <Button
              type="button"
              className="bg-slate-700 hover:bg-slate-800"
              onClick={() =>
                window.open(
                  `/gate-pass/verify?code=${gatePass.security_code}`,
                  "_blank",
                )
              }
            >
              Open Verification
            </Button>
          </div>
        </div>
      )}

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={handlePopupClose}
      />
    </div>
  );
}
