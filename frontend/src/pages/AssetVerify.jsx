import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import logo from "/logo.svg";
import { STORE_API_BASE_URL } from "@/lib/api-config";

const API = STORE_API_BASE_URL;

function extractCode(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";

  try {
    const maybeUrl = new URL(value);
    const fromUrl = maybeUrl.searchParams.get("code");
    if (fromUrl) return fromUrl.trim();
  } catch {
    // keep raw value
  }

  return value;
}

function fmtDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function statusTone(status) {
  const text = String(status || "").toLowerCase();
  if (text.includes("repair")) return "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700";
  if (text.includes("issued")) return "bg-blue-50 border-blue-200 text-blue-700";
  if (text.includes("store")) return "bg-emerald-50 border-emerald-200 text-emerald-700";
  if (text.includes("waste") || text.includes("disposed")) {
    return "bg-amber-50 border-amber-200 text-amber-800";
  }
  return "bg-slate-50 border-slate-200 text-slate-700";
}

function formatHolder(holder) {
  if (!holder) return "-";
  const parts = [
    holder.type || null,
    holder.id || null,
    holder.name || null,
    holder.division || holder.location || null,
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : "-";
}

export default function AssetVerify() {
  const location = useLocation();
  const queryCode = useMemo(
    () => new URLSearchParams(location.search).get("code") || "",
    [location.search],
  );

  const [inputCode, setInputCode] = useState(queryCode);
  const [resolvedCode, setResolvedCode] = useState(extractCode(queryCode));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadByCode = async (rawCode) => {
    const code = extractCode(rawCode);
    setResolvedCode(code);

    if (!code) {
      setError("Verification code is required.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await axios.get(`${API}/assets/verify`, {
        params: { code },
      });
      const data = res.data?.data || null;
      if (!data?.valid) {
        setError(data?.reason || "Verification failed.");
        return;
      }
      setResult(data);
    } catch (err) {
      const apiData = err?.response?.data?.data;
      const reason = apiData?.reason || err?.response?.data?.message;
      setError(reason || "Failed to verify asset code.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (queryCode) {
      setInputCode(queryCode);
      loadByCode(queryCode);
    }
  }, [queryCode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-emerald-50 px-4 py-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="HARTRON Logo" className="h-12 w-12 object-contain" />
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  Asset Verification
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Scan the printed asset QR or paste a full asset verify URL.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Public view shows scan-safe details.
              <br />
              Login adds holder details and timeline access.
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 md:flex-row">
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:w-[30rem]"
              placeholder="Enter asset verification code"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadByCode(inputCode);
              }}
            />
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
              onClick={() => loadByCode(inputCode)}
              disabled={loading}
            >
              {loading ? "Checking..." : "Verify Asset"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Verified Asset
                  </div>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                    {result.asset?.item_name || "Asset"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Code: <span className="font-medium break-all">{resolvedCode}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    QR Status: {result.asset?.verification_status || "Valid"}
                  </span>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(
                      result.asset?.status,
                    )}`}
                  >
                    {result.asset?.status || "-"}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-slate-500">Asset ID</div>
                  <div className="font-semibold text-slate-900">
                    {result.asset?.id || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-slate-500">Asset Tag</div>
                  <div className="font-semibold text-slate-900">
                    {result.asset?.asset_tag || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-slate-500">Serial Number</div>
                  <div className="font-semibold text-slate-900">
                    {result.asset?.serial_number || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-slate-500">Verified At</div>
                  <div className="font-semibold text-slate-900">
                    {fmtDate(result.verified_at)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-slate-500">Category</div>
                  <div className="font-semibold text-slate-900">
                    {result.asset?.category_name || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-slate-500">Current Location</div>
                  <div className="font-semibold text-slate-900">
                    {result.asset?.location_scope || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-slate-500">Last Event</div>
                  <div className="font-semibold text-slate-900">
                    {result.asset?.last_event_type || "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="text-slate-500">Last Movement</div>
                  <div className="font-semibold text-slate-900">
                    {fmtDate(result.asset?.last_event_date)}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Internal Details
                  </h3>
                  <p className="text-sm text-slate-600">
                    {result.access?.message || "Login is required for internal data."}
                  </p>
                </div>
                {result.access?.internal_allowed && result.internal?.timeline_path ? (
                  <Link
                    to={result.internal.timeline_path}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Open Full Timeline
                  </Link>
                ) : null}
              </div>

              {result.access?.internal_allowed && result.internal ? (
                <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                    <div className="text-slate-500">Current Holder</div>
                    <div className="font-semibold text-slate-900">
                      {formatHolder(result.internal.current_holder)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-slate-500">DayBook Entry</div>
                    <div className="font-semibold text-slate-900">
                      {result.internal.daybook_entry_no || "-"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-slate-500">Purchase Date</div>
                    <div className="font-semibold text-slate-900">
                      {fmtDate(result.internal.purchased_at)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-slate-500">Warranty Expiry</div>
                    <div className="font-semibold text-slate-900">
                      {fmtDate(result.internal.warranty_expiry)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="text-slate-500">Vendor</div>
                    <div className="font-semibold text-slate-900">
                      {result.internal.vendor_name || "-"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Holder, warranty, vendor, and full timeline open only after sign-in
                  with access to this asset&apos;s location.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
