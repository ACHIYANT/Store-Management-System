import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { STORE_API_BASE_URL } from "@/lib/api-config";

const API = STORE_API_BASE_URL;

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function getPendingItems(items, mode, isOneWayPass) {
  if (isOneWayPass || mode === "out") {
    return items.filter((it) => !it.out_verified_at);
  }
  return items.filter((it) => it.out_verified_at && !it.in_verified_at);
}

export default function GatePassVerify() {
  const location = useLocation();
  const queryCode = useMemo(
    () => new URLSearchParams(location.search).get("code") || "",
    [location.search],
  );

  const [code, setCode] = useState(queryCode);
  const [mode, setMode] = useState("out");
  const [gatePass, setGatePass] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState([]);
  const [scanValue, setScanValue] = useState("");

  const verifier =
    localStorage.getItem("fullname") ||
    localStorage.getItem("username") ||
    "Gate User";
  const isOneWayPass = gatePass?.purpose === "EWasteOut";

  const pendingItems = useMemo(() => {
    if (!gatePass?.items) return [];
    return getPendingItems(gatePass.items, mode, isOneWayPass);
  }, [gatePass, isOneWayPass, mode]);

  const refreshById = async (id) => {
    const res = await axios.get(`${API}/gate-passes/${id}`);
    const pass = res.data?.data || null;
    setGatePass(pass);
    if (pass?.purpose === "EWasteOut") {
      setMode("out");
    } else if (pass?.status === "OutVerified") {
      setMode("in");
    }
  };

  const loadByCode = async (nextCode) => {
    if (!nextCode?.trim()) {
      setError("Verification code is required.");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    setSelected([]);
    try {
      const res = await axios.get(`${API}/gate-passes/verify`, {
        params: { code: nextCode.trim() },
      });
      const data = res.data?.data;
      setGatePass(data?.gatePass || null);
      if (data?.gatePass?.purpose === "EWasteOut") {
        setMode("out");
      } else if (data?.gatePass?.status === "OutVerified") {
        setMode("in");
      } else {
        setMode("out");
      }
    } catch (err) {
      setGatePass(null);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to verify gate pass code.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (queryCode) loadByCode(queryCode);
  }, [queryCode]);

  const verifyAssets = async (assetIds) => {
    if (!gatePass?.id) return;
    const clean = [...new Set((assetIds || []).map(Number).filter(Boolean))];
    if (!clean.length) {
      setMessage("No assets selected for verification.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const activeMode = isOneWayPass ? "out" : mode;
      const endpoint =
        activeMode === "out"
          ? `${API}/gate-passes/${gatePass.id}/verify-out`
          : `${API}/gate-passes/${gatePass.id}/verify-in`;
      const res = await axios.patch(endpoint, {
        assetIds: clean,
        verifiedBy: verifier,
      });

      await refreshById(gatePass.id);
      setSelected([]);
      setScanValue("");
      setMessage(
        `${activeMode === "out" ? "Gate-out" : "Gate-in"} verified for ${clean.length} item(s).`,
      );

      if (isOneWayPass && res.data?.data?.gatePass?.status === "OutVerified") {
        setMessage("All items are verified for one-way E-Waste gate-out.");
      } else if (res.data?.data?.gatePass?.status === "InVerified") {
        setMessage("All items fully verified for OUT and IN.");
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update verification.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleScan = async () => {
    if (!scanValue.trim() || !gatePass?.items?.length) return;
    const raw = scanValue.trim().toLowerCase();

    const matched = gatePass.items.find((it) => {
      const candidates = [
        String(it.asset_id || ""),
        String(it.asset_tag || ""),
        String(it.serial_number || ""),
      ].map((v) => v.toLowerCase());
      return candidates.includes(raw);
    });

    if (!matched) {
      setError("Scanned value did not match any gate-pass asset.");
      return;
    }
    await verifyAssets([matched.asset_id]);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-semibold text-slate-900">Gate Verification</h1>
        <p className="text-sm text-slate-600 mt-1">
          Verify gate movement manually or by scanner input.
        </p>

        <div className="mt-3 flex flex-col md:flex-row gap-2">
          <input
            className="border border-slate-300 rounded px-3 py-2 text-sm w-full md:w-80"
            placeholder="Enter gate pass verification code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadByCode(code);
            }}
          />
          <button
            className="px-3 py-2 rounded bg-slate-900 text-white text-sm"
            onClick={() => loadByCode(code)}
            disabled={loading}
          >
            {loading ? "Checking..." : "Load Pass"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </div>
      )}

      {gatePass && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
              <div>
                <div className="text-slate-500">Pass No</div>
                <div className="font-semibold">{gatePass.pass_no}</div>
              </div>
              <div>
                <div className="text-slate-500">Status</div>
                <div className="font-semibold">{gatePass.status}</div>
              </div>
              <div>
                <div className="text-slate-500">Purpose</div>
                <div className="font-semibold">
                  {gatePass.purpose === "EWasteOut" ? "E-Waste Out" : "Repair Out"}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Issued</div>
                <div className="font-semibold">{fmtDate(gatePass.issued_at)}</div>
              </div>
              <div>
                <div className="text-slate-500">Verifier</div>
                <div className="font-semibold">{verifier}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={`px-3 py-1.5 rounded text-sm ${
                  mode === "out"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
                onClick={() => setMode("out")}
              >
                Gate-Out Mode
              </button>
              {!isOneWayPass && (
                <button
                  className={`px-3 py-1.5 rounded text-sm ${
                    mode === "in"
                      ? "bg-green-600 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                  onClick={() => setMode("in")}
                >
                  Gate-In Mode
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
              <input
                className="border border-slate-300 rounded px-3 py-2 text-sm"
                placeholder="Scan asset id / tag / serial and press Enter"
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleScan();
                  }
                }}
              />
              <button
                className="px-3 py-2 rounded bg-slate-700 text-white text-sm"
                onClick={handleScan}
                disabled={busy}
              >
                Verify Scanned
              </button>
              <button
                className="px-3 py-2 rounded bg-slate-900 text-white text-sm"
                onClick={() => verifyAssets(pendingItems.map((it) => it.asset_id))}
                disabled={busy || !pendingItems.length}
              >
                Verify All Pending
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b text-sm font-semibold text-slate-700">
              Items ({gatePass.items?.length || 0})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 border-b text-left">Select</th>
                    <th className="px-3 py-2 border-b text-left">Asset ID</th>
                    <th className="px-3 py-2 border-b text-left">Asset Tag</th>
                    <th className="px-3 py-2 border-b text-left">Serial Number</th>
                    <th className="px-3 py-2 border-b text-left">Current Status</th>
                    <th className="px-3 py-2 border-b text-left">Out Verified</th>
                    <th className="px-3 py-2 border-b text-left">In Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {(gatePass.items || []).map((item) => {
                    const disabled =
                      isOneWayPass || mode === "out"
                        ? Boolean(item.out_verified_at)
                        : !item.out_verified_at || Boolean(item.in_verified_at);
                    const checked = selected.includes(item.asset_id);
                    return (
                      <tr key={item.id} className="odd:bg-white even:bg-slate-50/40">
                        <td className="px-3 py-2 border-b">
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={checked}
                            onChange={() =>
                              setSelected((prev) =>
                                checked
                                  ? prev.filter((id) => id !== item.asset_id)
                                  : [...prev, item.asset_id],
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2 border-b">{item.asset_id}</td>
                        <td className="px-3 py-2 border-b">{item.asset_tag || "-"}</td>
                        <td className="px-3 py-2 border-b">
                          {item.serial_number || "-"}
                        </td>
                        <td className="px-3 py-2 border-b">
                          {item.asset_status || "-"}
                        </td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t flex gap-2">
              <button
                className="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-60"
                onClick={() => verifyAssets(selected)}
                disabled={busy || !selected.length}
              >
                Verify Selected ({selected.length})
              </button>
              <button
                className="px-3 py-2 rounded bg-slate-200 text-slate-700 text-sm"
                onClick={() => setSelected([])}
              >
                Clear Selection
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
