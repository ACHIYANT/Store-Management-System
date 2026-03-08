import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRef, useState } from "react";
import PopupMessage from "@/components/PopupMessage";

export default function AssetFinalizeForm({ assetIds = [], onDone }) {
  const [type, setType] = useState("Disposed");
  const [notes, setNotes] = useState("");
  const [approvalFile, setApprovalFile] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const submit = async () => {
    if (submitting) return;
    if (!assetIds.length)
      return setPopup({
        open: true,
        type: "error",
        message: "No assets selected",
      });
    if (!approvalFile)
      return setPopup({
        open: true,
        type: "error",
        message: "Approval document is required.",
      });
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("assetIds", JSON.stringify(assetIds));
      formData.append("type", type);
      if (notes) formData.append("notes", notes);
      formData.append("entry_no", `ASSET-FINALIZE-${type.toUpperCase()}`);
      formData.append("bill_no", `${Date.now()}-${assetIds.length}`);
      formData.append("file", approvalFile);

      await axios.patch("http://localhost:3000/api/v1/assets/finalize", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const displayType = type === "EWaste" ? "E-Waste" : type;
      setPopup({
        open: true,
        type: "success",
        message: `Marked ${displayType} (${assetIds.length})`,
      });
      setNotes("");
      setApprovalFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (e) {
      setPopup({
        open: true,
        type: "error",
        message: e?.response?.data?.message || e.message || "Finalize failed.",
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
      <div>
        <label className="text-xs text-gray-600">Type</label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Disposed">Disposed</SelectItem>
            <SelectItem value="Lost">Lost</SelectItem>
            <SelectItem value="EWaste">E-Waste</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <input
        className="border rounded p-2 h-11"
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
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
      <Button onClick={submit} disabled={submitting}>
        {submitting ? "Please wait..." : "Confirm"}
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
