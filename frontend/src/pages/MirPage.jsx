import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import logo from "/logo.svg";
import { formatDivisionDisplayLabel } from "@/lib/divisions";
import { toStoreApiUrl } from "@/lib/api-config";

const formatQty = (value, skuUnit) => {
  const qty = Number(value);
  const normalized = Number.isFinite(qty)
    ? Number.isInteger(qty)
      ? String(parseInt(qty, 10))
      : qty.toFixed(3).replace(/\.?0+$/, "")
    : "0";
  return `${normalized} ${skuUnit || "Unit"}`;
};

const formatRoleLabel = (value) =>
  String(value || "")
    .trim()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");

const previewUrl = (storedUrl) => {
  if (!storedUrl) return "";
  const relativePath = storedUrl.replace(/^\/?uploads\//, "");
  return toStoreApiUrl(`/view-image?path=${encodeURIComponent(relativePath)}`);
};

export default function MirPage() {
  const { mirId } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [mir, setMir] = useState(null);
  const [userName, setUserName] = useState("Login Name");
  const [printTimestamp, setPrintTimestamp] = useState("");
  const [signedFile, setSignedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const fetchMir = async () => {
    const response = await axios.get(toStoreApiUrl(`/mirs/${mirId}`));
    setMir(response?.data?.data || null);
  };

  useEffect(() => {
    fetchMir().catch((error) => {
      console.error("Failed to load MIR:", error);
      alert(error?.response?.data?.message || "Failed to load MIR.");
    });
  }, [mirId]);

  useEffect(() => {
    const storedUser = localStorage.getItem("fullname");
    if (storedUser) setUserName(storedUser);
  }, []);

  useEffect(() => {
    const handleBeforePrint = () => {
      setPrintTimestamp(new Date().toLocaleString());
    };
    handleBeforePrint();
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => window.removeEventListener("beforeprint", handleBeforePrint);
  }, []);

  if (!mir) {
    return <div>Loading MIR...</div>;
  }

  const signedPreview = mir?.signed_mir_url ? previewUrl(mir.signed_mir_url) : "";
  const displayReceiverDivision = mir?.receiver?.division
    ? formatDivisionDisplayLabel(mir.receiver.division)
    : "—";
  const displaySignatoryDivision = mir?.signatory?.division
    ? formatDivisionDisplayLabel(mir.signatory.division)
    : "—";

  const handleUploadSignedMir = async () => {
    if (!signedFile) {
      alert("Select the signed MIR file first.");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", signedFile);
      formData.append("entry_no", mir.mir_no || `mir-${mir.id}`);
      formData.append(
        "bill_no",
        mir?.requisition?.req_no || mir?.requisition_req_no || `req-${mir.id}`,
      );

      await axios.post(
        toStoreApiUrl(`/mirs/${mir.id}/upload-signed`),
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSignedFile(null);
      await fetchMir();
    } catch (error) {
      console.error("Failed to upload signed MIR:", error);
      alert(error?.response?.data?.message || "Failed to upload signed MIR.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="print-container">
      <button
        className="mb-4 rounded bg-black px-4 py-2 text-white hover:bg-zinc-700 print:hidden"
        onClick={() => navigate("/mirs")}
      >
        ← Back To MIR List
      </button>

      <div className="print-watermark">
        <span>
          {mir.status === "SIGNED_UPLOADED" ? (
            <>
              SIGNED MIR
              <br />
              SYSTEM GENERATED
            </>
          ) : (
            <>
              OFFICIAL MIR
              <br />
              SYSTEM GENERATED
            </>
          )}
        </span>
      </div>

      <div className="print-content">
        <header className="display-block-force mb-4 flex flex-col items-center justify-between border-b pb-2">
          <img src={logo} alt="Company Logo" className="mt-2 h-20" />
          <h1 className="blockcls flex-1 text-center text-2xl font-bold">
            Haryana State Electronics Development Co-operation Ltd.
          </h1>
          <h2>(Haryana Government Undertaking)</h2>
          <h2>S.C.O. 111-113, SECTOR-17-B, CHANDIGARH - 160017</h2>
        </header>

        <h2 className="mb-2 text-center text-xl font-semibold">
          Material Issue Receipt (MIR)
        </h2>

        {mir.status === "SIGNED_UPLOADED" ? (
          <div className="mb-3 rounded bg-green-100 p-2 text-center text-green-800">
            Signed MIR uploaded on{" "}
            {mir.uploaded_at ? new Date(mir.uploaded_at).toLocaleString() : "—"}
          </div>
        ) : (
          <div className="mb-3 rounded bg-red-100 p-2 text-center text-red-800">
            Signed MIR is pending upload.
          </div>
        )}

        <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
          <div className="col-span-1 p-2">
            <strong>Issued To:</strong>
            <p>{mir.receiver?.name || "—"}</p>
            <p>Receiver Type: {formatRoleLabel(mir.receiver?.type) || "—"}</p>
            <p>Designation: {mir.receiver?.designation || "—"}</p>
            <p>Division: {displayReceiverDivision}</p>
          </div>

          <div className="col-span-2 grid grid-cols-2 gap-2">
            <div>
              <strong>MIR No:</strong> {mir.mir_no}
            </div>
            <div>
              <strong>Requisition No:</strong> {mir?.requisition?.req_no || "—"}
            </div>
            <div>
              <strong>Issue Date:</strong>{" "}
              {mir.issued_at ? new Date(mir.issued_at).toLocaleString() : "—"}
            </div>
            <div>
              <strong>Status:</strong> {formatRoleLabel(mir.status)}
            </div>
            <div>
              <strong>Requester:</strong> {mir?.requisition?.requester_name || "—"}
            </div>
            <div>
              <strong>Requester Division:</strong>{" "}
              {mir?.requisition?.requester_division
                ? formatDivisionDisplayLabel(mir.requisition.requester_division)
                : "—"}
            </div>
            <div className="col-span-2">
              <strong>Purpose:</strong> {mir?.requisition?.purpose || "—"}
            </div>
          </div>
        </div>

        <table className="w-full border-collapse border text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-1">#</th>
              <th className="border p-1">Item</th>
              <th className="border p-1">Category</th>
              <th className="border p-1">Approved Qty</th>
              <th className="border p-1">Issued Qty</th>
              <th className="border p-1">Serials / Asset Tags</th>
            </tr>
          </thead>
          <tbody>
            {(mir.items || []).map((item, index) => (
              <tr key={item.requisition_item_id || index}>
                <td className="border p-1">{index + 1}</td>
                <td className="border p-1">{item.particulars}</td>
                <td className="border p-1">{item.category_name || "—"}</td>
                <td className="border p-1">
                  {formatQty(item.approved_qty, item.sku_unit)}
                </td>
                <td className="border p-1">
                  {formatQty(item.issued_qty, item.sku_unit)}
                </td>
                <td className="border p-1">
                  {Array.isArray(item.asset_labels) && item.asset_labels.length > 0
                    ? item.asset_labels.join(", ")
                    : "—"}
                </td>
              </tr>
            ))}
            <tr>
              <td className="border p-1"></td>
              <td className="border p-1">
                <strong>Total Lines</strong>
              </td>
              <td className="border p-1"></td>
              <td className="border p-1"></td>
              <td className="border p-1">
                <strong>{mir?.totals?.line_count || 0}</strong>
              </td>
              <td className="border p-1">
                <strong>{mir?.totals?.serialized_asset_count || 0} assets</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-2 gap-8 text-sm">
          <div className="mt-10 border-t pt-2">
            <p>
              <strong>Issued By:</strong> {userName}
            </p>
            {printTimestamp && (
              <p>
                <strong>Printed On:</strong> {printTimestamp}
              </p>
            )}
          </div>
          <div className="mt-10 border-t pt-2">
            <p>
              <strong>To Be Signed By:</strong>{" "}
              {mir?.signatory?.name || formatRoleLabel(mir?.signatory?.role) || "Receiver"}
            </p>
            <p>
              <strong>Designation:</strong>{" "}
              {mir?.signatory?.designation || mir?.receiver?.designation || "—"}
            </p>
            <p>
              <strong>Division:</strong>{" "}
              {mir?.signatory?.division ? displaySignatoryDivision : displayReceiverDivision}
            </p>
            <p className="mt-4">
              <strong>Signature:</strong> ________________________
            </p>
          </div>
        </div>

        <div className="mt-2 print-only">
          <p className="text-[0.723rem]">
            <strong>
              This is the system generated MIR for an online requisition. The
              physical signed copy should be uploaded back into the system after
              receipt.
            </strong>
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Print MIR
          </button>

          {signedPreview ? (
            <button
              onClick={() => window.open(signedPreview, "_blank", "noopener,noreferrer")}
              className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
            >
              View Signed MIR
            </button>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            onChange={(event) => setSignedFile(event.target.files?.[0] || null)}
            className="rounded border border-slate-300 bg-white px-3 py-2"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
          />

          <button
            onClick={handleUploadSignedMir}
            disabled={!signedFile || uploading}
            className="rounded bg-slate-900 px-4 py-2 text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading
              ? "Uploading..."
              : mir.status === "SIGNED_UPLOADED"
                ? "Replace Signed MIR"
                : "Upload Signed MIR"}
          </button>
        </div>
      </div>
    </div>
  );
}
