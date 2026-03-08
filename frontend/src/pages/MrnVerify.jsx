import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";

const API = "http://localhost:3000/api/v1";

function extractCode(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";

  // Accept pasted full URL as well as raw code
  try {
    const maybeUrl = new URL(value);
    const fromUrl = maybeUrl.searchParams.get("code");
    if (fromUrl) return fromUrl.trim();
  } catch {
    // not a URL, keep raw value
  }

  return value;
}

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("cancel")) return "bg-red-50 border-red-200 text-red-700";
  if (s.includes("approved") || s.includes("active")) {
    return "bg-green-50 border-green-200 text-green-700";
  }
  return "bg-slate-50 border-slate-200 text-slate-700";
}

export default function MrnVerify() {
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
      const res = await axios.get(`${API}/mrn/verify`, {
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
      setError(reason || "Failed to verify MRN code.");
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
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-semibold text-slate-900">MRN Verification</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter MRN verification code from QR or paste a full MRN verify URL.
        </p>

        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <input
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm md:w-[28rem]"
            placeholder="Enter MRN verification code"
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadByCode(inputCode);
            }}
          />
          <button
            className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={() => loadByCode(inputCode)}
            disabled={loading}
          >
            {loading ? "Checking..." : "Verify MRN"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
            <div>
              <div className="text-slate-500">Verification Code</div>
              <div className="font-semibold break-all">{resolvedCode}</div>
            </div>
            <div>
              <div className="text-slate-500">MRN Entry No</div>
              <div className="font-semibold">{result.entry_no || "-"}</div>
            </div>
            <div>
              <div className="text-slate-500">Current Status</div>
              <div
                className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${statusTone(
                  result.status,
                )}`}
              >
                {result.status || "-"}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Verified At</div>
              <div className="font-semibold">{fmtDate(result.verified_at)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
