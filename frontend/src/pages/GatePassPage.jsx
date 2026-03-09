import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import logo from "/logo.svg";
import { STORE_API_BASE_URL } from "@/lib/api-config";

const API = STORE_API_BASE_URL;

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function statusClass(status) {
  const map = {
    Open: "bg-amber-100 text-amber-800",
    OutVerified: "bg-blue-100 text-blue-800",
    InVerified: "bg-green-100 text-green-800",
  };
  return map[status] || "bg-gray-100 text-gray-700";
}

function verificationProgressLabel(doneCount, totalCount) {
  const done = Number(doneCount) || 0;
  const total = Number(totalCount) || 0;
  if (total <= 0) return "Need to be done";
  if (done <= 0) return "Need to be done";
  if (done >= total) return "Done";
  return `Partially done (${done}/${total})`;
}

function formatPurpose(value) {
  if (!value) return "-";
  if (value === "RepairOut") return "Repair Out";
  if (value === "EWasteOut") return "E-Waste Out";
  return value;
}

export default function GatePassPage() {
  const { gatePassId } = useParams();
  const navigate = useNavigate();
  const [gatePass, setGatePass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [printTimestamp, setPrintTimestamp] = useState("");
  const [employees, setEmployees] = useState([]);
  const [signatoryForm, setSignatoryForm] = useState(null);
  const [savingSignatories, setSavingSignatories] = useState(false);
  const [saveNotice, setSaveNotice] = useState({ type: "", message: "" });
  const isOneWayPass = gatePass?.purpose === "EWasteOut";
  const passDisplayTitle = isOneWayPass
    ? "Asset E-Waste Gate Pass"
    : "Asset Repair Gate Pass";

  const printedBy =
    localStorage.getItem("fullname") ||
    localStorage.getItem("username") ||
    "System User";

  const verificationUrl = useMemo(() => {
    if (!gatePass?.security_code) return "";
    return `${window.location.origin}/gate-pass/verify?code=${gatePass.security_code}`;
  }, [gatePass]);

  const issuedTo = useMemo(() => {
    const fromResponse = Array.isArray(gatePass?.issued_to) ? gatePass.issued_to : [];
    if (fromResponse.length) return fromResponse;

    const map = new Map();
    (gatePass?.items || []).forEach((item) => {
      const employee = item?.current_employee;
      if (!employee) return;
      const key =
        employee.emp_id != null
          ? `emp:${employee.emp_id}`
          : `emp:${employee.name || ""}:${employee.designation || ""}`;
      if (!map.has(key)) {
        map.set(key, employee);
      }
    });
    return Array.from(map.values());
  }, [gatePass]);

  const vendorRepresentatives = useMemo(() => {
    const fromResponse = Array.isArray(gatePass?.vendor_representatives)
      ? gatePass.vendor_representatives
      : [];
    if (fromResponse.length) return fromResponse;

    const map = new Map();
    (gatePass?.items || []).forEach((item) => {
      const vendor = item?.vendor;
      if (!vendor) return;
      const key =
        vendor.id != null
          ? `vendor:${vendor.id}`
          : `vendor:${vendor.name || ""}:${vendor.address || ""}`;
      if (!map.has(key)) {
        map.set(key, vendor);
      }
    });
    return Array.from(map.values());
  }, [gatePass]);

  const resolvedIssuedSignatory = useMemo(() => {
    const source =
      signatoryForm ||
      (() => {
        const fromApi = gatePass?.signatories?.issued_to;
        if (fromApi) {
          return {
            issuedEmpId:
              fromApi.emp_id != null ? String(fromApi.emp_id) : "",
            issuedName: fromApi.name || "",
            issuedDesignation: fromApi.designation || "",
            issuedDivision: fromApi.division || "",
          };
        }
        const fallback = issuedTo[0] || null;
        return {
          issuedEmpId:
            fallback?.emp_id != null ? String(fallback.emp_id) : "",
          issuedName: fallback?.name || "",
          issuedDesignation: fallback?.designation || "",
          issuedDivision: fallback?.division || "",
        };
      })();

    const name = source?.issuedName?.trim() || "Store Incharge";
    const designation =
      source?.issuedDesignation?.trim() ||
      (name === "Store Incharge" ? "Store Incharge" : "-");
    return {
      emp_id: source?.issuedEmpId ? Number(source.issuedEmpId) : null,
      name,
      designation,
      division: source?.issuedDivision?.trim() || null,
    };
  }, [gatePass, issuedTo, signatoryForm]);

  const resolvedVendorSignatory = useMemo(() => {
    const source =
      signatoryForm ||
      (() => {
        const fromApi = gatePass?.signatories?.vendor_representative;
        if (fromApi) {
          return {
            vendorName: fromApi.name || "",
            vendorAddress: fromApi.address || "",
          };
        }
        const fallback = vendorRepresentatives[0] || null;
        return {
          vendorName: fallback?.name || "",
          vendorAddress: fallback?.address || "",
        };
      })();

    return {
      name: source?.vendorName?.trim() || null,
      address: source?.vendorAddress?.trim() || null,
    };
  }, [gatePass, signatoryForm, vendorRepresentatives]);

  useEffect(() => {
    if (!gatePassId) {
      setLoading(false);
      setError("Missing gate pass id in URL.");
      return;
    }

    setLoading(true);
    setError("");

    axios
      .get(`${API}/gate-passes/${gatePassId}`)
      .then((res) => setGatePass(res.data?.data || null))
      .catch((err) => {
        setGatePass(null);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Failed to fetch gate pass.",
        );
      })
      .finally(() => setLoading(false));
  }, [gatePassId]);

  useEffect(() => {
    axios
      .get(`${API}/employee`)
      .then((res) => setEmployees(res.data?.data || []))
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    if (!gatePass) return;
    const issuedFromApi = gatePass?.signatories?.issued_to;
    const fallbackIssued = issuedTo[0] || {};
    const vendorFromApi = gatePass?.signatories?.vendor_representative;
    const fallbackVendor = vendorRepresentatives[0] || {};

    setSignatoryForm({
      issuedEmpId:
        issuedFromApi?.emp_id != null
          ? String(issuedFromApi.emp_id)
          : fallbackIssued?.emp_id != null
            ? String(fallbackIssued.emp_id)
            : "",
      issuedName:
        issuedFromApi?.name || fallbackIssued?.name || "Store Incharge",
      issuedDesignation:
        issuedFromApi?.designation ||
        fallbackIssued?.designation ||
        "Store Incharge",
      issuedDivision:
        issuedFromApi?.division || fallbackIssued?.division || "",
      vendorName: vendorFromApi?.name || fallbackVendor?.name || "",
      vendorAddress:
        vendorFromApi?.address || fallbackVendor?.address || "",
    });
    setSaveNotice({ type: "", message: "" });
  }, [gatePass, issuedTo, vendorRepresentatives]);

  useEffect(() => {
    const updatePrintTime = () => {
      setPrintTimestamp(new Date().toLocaleString());
    };
    updatePrintTime();
    window.addEventListener("beforeprint", updatePrintTime);
    return () => window.removeEventListener("beforeprint", updatePrintTime);
  }, []);

  const onIssuedEmployeeChange = (value) => {
    setSignatoryForm((prev) => {
      if (!prev) return prev;
      if (!value) {
        return {
          ...prev,
          issuedEmpId: "",
          issuedName: "Store Incharge",
          issuedDesignation: "Store Incharge",
          issuedDivision: "",
        };
      }

      const emp = employees.find((e) => String(e.emp_id) === String(value));
      if (!emp) return { ...prev, issuedEmpId: value };

      return {
        ...prev,
        issuedEmpId: String(emp.emp_id),
        issuedName: emp.name || prev.issuedName,
        issuedDesignation: emp.designation || prev.issuedDesignation,
        issuedDivision: emp.division || "",
      };
    });
  };

  const saveSignatories = async () => {
    if (!gatePassId || !signatoryForm || savingSignatories) return;
    try {
      setSavingSignatories(true);
      setSaveNotice({ type: "", message: "" });
      const res = await axios.patch(
        `${API}/gate-passes/${gatePassId}/signatories`,
        {
          issued_signatory_emp_id: signatoryForm.issuedEmpId || null,
          issued_signatory_name: signatoryForm.issuedName || null,
          issued_signatory_designation:
            signatoryForm.issuedDesignation || null,
          issued_signatory_division: signatoryForm.issuedDivision || null,
          vendor_signatory_name: signatoryForm.vendorName || null,
          vendor_signatory_address: signatoryForm.vendorAddress || null,
        },
      );
      setGatePass(res.data?.data || null);
      setSaveNotice({ type: "success", message: "Signatory details updated." });
    } catch (err) {
      setSaveNotice({
        type: "error",
        message:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to update signatory details.",
      });
    } finally {
      setSavingSignatories(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading gate pass...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
        <button
          className="mt-3 px-3 py-1.5 rounded border border-gray-300 text-sm"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
      </div>
    );
  }

  if (!gatePass) {
    return <div className="p-4 text-sm text-gray-500">Gate pass not found.</div>;
  }

  return (
    <div className="p-4 space-y-4 print-container">
      <div className="flex items-center gap-2 print:hidden">
        <button
          className="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-50"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
        <button
          className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
          onClick={() => window.print()}
        >
          Print Gate Pass
        </button>
      </div>

      <div className="print:hidden space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {passDisplayTitle}
              </p>
              <h1 className="text-2xl font-semibold text-slate-900">{gatePass.pass_no}</h1>
              <p className="text-sm text-slate-600 mt-1">
                Issued: {fmtDate(gatePass.issued_at)}
              </p>
              <p className="text-sm text-slate-600">
                Purpose: {formatPurpose(gatePass.purpose)}
              </p>
            </div>

            <div className="flex flex-col gap-2 items-start md:items-end">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(gatePass.status)}`}
              >
                {gatePass.status}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs text-slate-500">Total Items</div>
            <div className="text-lg font-semibold text-slate-800">
              {gatePass.totals?.total_items || 0}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs text-slate-500">Gate-Out Verification</div>
            <div className="text-sm font-semibold text-slate-800">
              {verificationProgressLabel(
                gatePass.totals?.out_verified,
                gatePass.totals?.total_items,
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              ({gatePass.totals?.out_verified || 0}/{gatePass.totals?.total_items || 0})
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs text-slate-500">Gate-In Verification</div>
            <div className="text-sm font-semibold text-slate-800">
              {isOneWayPass
                ? "Not required"
                : verificationProgressLabel(
                    gatePass.totals?.in_verified,
                    gatePass.totals?.total_items,
                  )}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {isOneWayPass
                ? "(One-way E-Waste movement)"
                : `(${gatePass.totals?.in_verified || 0}/${gatePass.totals?.total_items || 0})`}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <div className="text-sm">
                <span className="text-slate-500">Verification Code:</span>{" "}
                <span className="font-semibold">{gatePass.security_code}</span>
              </div>
              <div className="text-sm">
                <span className="text-slate-500">Out Verified At:</span>{" "}
                <span className="font-semibold">{fmtDate(gatePass.out_verified_at)}</span>
              </div>
              <div className="text-sm">
                <span className="text-slate-500">In Verified At:</span>{" "}
                <span className="font-semibold">
                  {isOneWayPass ? "Not required" : fmtDate(gatePass.in_verified_at)}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-slate-500">Notes:</span>{" "}
                <span className="font-semibold">{gatePass.notes || "No notes"}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {verificationUrl ? (
                <>
                  <QRCodeSVG
                    value={verificationUrl}
                    size={130}
                    level="H"
                    marginSize={2}
                  />
                  <div className="text-xs text-slate-600 leading-relaxed">
                    <div>Scan to verify at gate</div>
                    <button
                      className="mt-2 px-2 py-1 rounded bg-slate-900 text-white text-xs"
                      onClick={() =>
                        window.open(
                          `/gate-pass/verify?code=${gatePass.security_code}`,
                          "_blank",
                        )
                      }
                    >
                      Open Verify
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-sm text-slate-500">QR not available</div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                Issued Signatory
              </h3>
              <div className="space-y-2">
                <label className="block text-xs text-slate-600">
                  Choose Employee
                </label>
                <select
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={signatoryForm?.issuedEmpId || ""}
                  onChange={(e) => onIssuedEmployeeChange(e.target.value)}
                >
                  <option value="">Store Incharge (No employee)</option>
                  {employees.map((e) => (
                    <option key={e.emp_id} value={e.emp_id}>
                      {e.emp_id} - {e.name}
                    </option>
                  ))}
                </select>

                <label className="block text-xs text-slate-600">Name</label>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={signatoryForm?.issuedName || ""}
                  onChange={(e) =>
                    setSignatoryForm((prev) =>
                      prev ? { ...prev, issuedName: e.target.value } : prev,
                    )
                  }
                />

                <label className="block text-xs text-slate-600">
                  Designation
                </label>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={signatoryForm?.issuedDesignation || ""}
                  onChange={(e) =>
                    setSignatoryForm((prev) =>
                      prev
                        ? { ...prev, issuedDesignation: e.target.value }
                        : prev,
                    )
                  }
                />

                <label className="block text-xs text-slate-600">Division</label>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={signatoryForm?.issuedDivision || ""}
                  onChange={(e) =>
                    setSignatoryForm((prev) =>
                      prev ? { ...prev, issuedDivision: e.target.value } : prev,
                    )
                  }
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                Vendor Signatory
              </h3>
              <div className="space-y-2">
                <label className="block text-xs text-slate-600">Name</label>
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={signatoryForm?.vendorName || ""}
                  onChange={(e) =>
                    setSignatoryForm((prev) =>
                      prev ? { ...prev, vendorName: e.target.value } : prev,
                    )
                  }
                />

                <label className="block text-xs text-slate-600">Address</label>
                <textarea
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm min-h-20"
                  value={signatoryForm?.vendorAddress || ""}
                  onChange={(e) =>
                    setSignatoryForm((prev) =>
                      prev ? { ...prev, vendorAddress: e.target.value } : prev,
                    )
                  }
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-3">
            {saveNotice.message && (
              <p
                className={`text-xs ${
                  saveNotice.type === "error" ? "text-red-600" : "text-green-700"
                }`}
              >
                {saveNotice.message}
              </p>
            )}
            <button
              type="button"
              className="px-3 py-1.5 rounded bg-slate-900 text-white text-sm disabled:opacity-60"
              onClick={saveSignatories}
              disabled={savingSignatories || !signatoryForm}
            >
              {savingSignatories ? "Saving..." : "Save Signatory Details"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b text-sm font-semibold text-slate-700">
            Gate Pass Items
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 border-b">#</th>
                  <th className="text-left px-3 py-2 border-b">Asset ID</th>
                  <th className="text-left px-3 py-2 border-b">Asset Tag</th>
                  <th className="text-left px-3 py-2 border-b">Serial Number</th>
                  <th className="text-left px-3 py-2 border-b">Current Status</th>
                  <th className="text-left px-3 py-2 border-b">Gate-Out</th>
                  <th className="text-left px-3 py-2 border-b">Gate-In</th>
                </tr>
              </thead>
              <tbody>
                {(gatePass.items || []).map((item, idx) => (
                  <tr key={item.id} className="odd:bg-white even:bg-slate-50/40">
                    <td className="px-3 py-2 border-b">{idx + 1}</td>
                    <td className="px-3 py-2 border-b">{item.asset_id}</td>
                    <td className="px-3 py-2 border-b">{item.asset_tag || "-"}</td>
                    <td className="px-3 py-2 border-b">{item.serial_number || "-"}</td>
                    <td className="px-3 py-2 border-b">{item.asset_status || "-"}</td>
                    <td className="px-3 py-2 border-b">
                      {item.out_verified_at
                        ? `${fmtDate(item.out_verified_at)} (${item.out_verified_by || "Gate"})`
                        : "Pending"}
                    </td>
                    <td className="px-3 py-2 border-b">
                      {isOneWayPass
                        ? "Not required"
                        : item.in_verified_at
                          ? `${fmtDate(item.in_verified_at)} (${item.in_verified_by || "Gate"})`
                          : "Pending"}
                    </td>
                  </tr>
                ))}
                {!gatePass.items?.length && (
                  <tr>
                    <td className="px-3 py-6 text-center text-slate-500" colSpan={7}>
                      No assets found for this gate pass.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="print-only print-content">
        <header className="display-block-force flex flex-col items-center justify-between border-b pb-2 mb-4">
          <img src={logo} alt="Company Logo" className="h-20 mt-2" />
          <h1 className="text-2xl font-bold text-center blockcls">
            Haryana State Electronics Development Co-operation Ltd.
          </h1>
          <h2>(Haryana Government Undertaking)</h2>
          <h2>S.C.O. 111-113, SECTOR-17-B, CHANDIGARH - 160017</h2>
        </header>

        <h2 className="text-xl font-semibold mb-3 text-center">{passDisplayTitle}</h2>

        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
          <div>
            <strong>Pass No:</strong> {gatePass.pass_no}
          </div>
          <div>
            <strong>Status:</strong> {gatePass.status}
          </div>
          <div>
            <strong>Purpose:</strong> {formatPurpose(gatePass.purpose)}
          </div>
          <div>
            <strong>Issued At:</strong> {fmtDate(gatePass.issued_at)}
          </div>
          <div>
            <strong>Verification Code:</strong> {gatePass.security_code}
          </div>
          <div>
            <strong>Total Items:</strong> {gatePass.totals?.total_items || 0}
          </div>
          <div>
            <strong>Gate-Out Verification:</strong>{" "}
            {verificationProgressLabel(
              gatePass.totals?.out_verified,
              gatePass.totals?.total_items,
            )}
          </div>
          <div>
            <strong>Gate-In Verification:</strong>{" "}
            {isOneWayPass
              ? "Not required"
              : verificationProgressLabel(
                  gatePass.totals?.in_verified,
                  gatePass.totals?.total_items,
                )}
          </div>
          <div className="col-span-2">
            <strong>Notes:</strong> {gatePass.notes || "No notes"}
          </div>
        </div>

        <table className="w-full border border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-1">#</th>
              <th className="border p-1">Asset ID</th>
              <th className="border p-1">Asset Tag</th>
              <th className="border p-1">Serial Number</th>
              <th className="border p-1">Current Status</th>
              <th className="border p-1">Gate-Out</th>
              <th className="border p-1">Gate-In</th>
            </tr>
          </thead>
          <tbody>
            {(gatePass.items || []).map((item, idx) => (
              <tr key={`print-${item.id}`}>
                <td className="border p-1">{idx + 1}</td>
                <td className="border p-1">{item.asset_id}</td>
                <td className="border p-1">{item.asset_tag || "-"}</td>
                <td className="border p-1">{item.serial_number || "-"}</td>
                <td className="border p-1">{item.asset_status || "-"}</td>
                <td className="border p-1">
                  {item.out_verified_at
                    ? `${fmtDate(item.out_verified_at)} (${item.out_verified_by || "Gate"})`
                    : "Pending"}
                </td>
                <td className="border p-1">
                  {isOneWayPass
                    ? "Not required"
                    : item.in_verified_at
                      ? `${fmtDate(item.in_verified_at)} (${item.in_verified_by || "Gate"})`
                      : "Pending"}
                </td>
              </tr>
            ))}
            {!gatePass.items?.length && (
              <tr>
                <td className="border p-2 text-center" colSpan={7}>
                  No assets found for this gate pass.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="border p-2">
            <h3 className="font-semibold mb-2">Issued To (Employee)</h3>
            <div>
              <p className="m-0">
                <strong>Name:</strong> {resolvedIssuedSignatory.name || "-"}
              </p>
              <p className="m-0">
                <strong>Employee ID:</strong>{" "}
                {resolvedIssuedSignatory.emp_id ?? "-"}
              </p>
              <p className="m-0">
                <strong>Designation:</strong>{" "}
                {resolvedIssuedSignatory.designation || "-"}
              </p>
              {resolvedIssuedSignatory.emp_id != null && (
                <p className="m-0">
                  <strong>Division:</strong>{" "}
                  {resolvedIssuedSignatory.division || "-"}
                </p>
              )}
              <p className="mt-2 mb-0">
                <strong>Signature:</strong> ____________________
              </p>
            </div>
          </div>

          <div className="border p-2">
            <h3 className="font-semibold mb-2">Vendor Representative</h3>
            <div>
              <p className="m-0">
                <strong>Name:</strong> {resolvedVendorSignatory.name || "-"}
              </p>
              <p className="m-0">
                <strong>Address:</strong>{" "}
                {resolvedVendorSignatory.address || "-"}
              </p>
              <p className="mt-2 mb-0">
                <strong>Signature:</strong> ____________________
              </p>
            </div>
          </div>
        </div>

        <div className="print-only display-block-force flex flex-row justify-between mt-4">
          <div className="text-sm leading-tight">
            <p className="m-0">
              <strong>Prepared By:</strong> {gatePass.created_by || printedBy}
            </p>
            <p className="m-0">
              <strong>Printed By:</strong> {printedBy}
            </p>
            {printTimestamp && (
              <p className="m-0">
                <strong>Printed on:</strong> {printTimestamp}
              </p>
            )}
          </div>

          {verificationUrl && (
            <div className="mt-1 flex items-center gap-2">
              <QRCodeSVG
                value={verificationUrl}
                size={120}
                level="H"
                marginSize={2}
                imageSettings={{
                  src: "/logo.svg",
                  x: undefined,
                  y: undefined,
                  height: 32,
                  width: 32,
                  excavate: true,
                }}
              />
              <div className="text-xs leading-tight">
                <p className="text-[0.68rem]">Scan QR to verify Gate Pass</p>
              </div>
            </div>
          )}
        </div>

        <div className="print-only mt-2">
          <p className="text-[0.723rem]">
            <strong>
              System generated gate pass. Obtain manual signatures in the
              designated sections during gate movement.
            </strong>
          </p>
        </div>
      </div>
    </div>
  );
}
