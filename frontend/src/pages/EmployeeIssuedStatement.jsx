import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import logo from "/logo.svg";
import loaderVideo from "../assets/Paperplane.webm";
import { STORE_API_BASE_URL } from "@/lib/api-config";

const API_BASE = STORE_API_BASE_URL;
const ISSUED_PAGE_SIZE = 500;
const MAX_STATEMENT_ROWS = 50000;
const CUSTODIAN_TYPES = new Set(["EMPLOYEE", "DIVISION", "VEHICLE"]);
const inferCustodianTypeFromId = (value) => {
  const text = String(value || "").trim().toUpperCase();
  if (text.startsWith("DIV-")) return "DIVISION";
  if (text.startsWith("VEH-")) return "VEHICLE";
  return "";
};

const safe = (value) => (value == null || value === "" ? "-" : value);
const isValidAssetId = (value) => {
  if (value == null) return false;
  const normalized = String(value).trim();
  return normalized !== "" && normalized !== "-";
};
const renderAssetLink = (assetId, label) => {
  if (!isValidAssetId(assetId)) return safe(label);
  return (
    <Link
      to={`/asset/${assetId}/timeline`}
      className="text-blue-600 underline hover:text-blue-800 print:text-black print:no-underline"
    >
      {safe(label)}
    </Link>
  );
};
const renderTimelineLink = (assetId, label) => {
  if (!isValidAssetId(assetId)) return safe(label);
  return (
    <Link
      to={`/asset/${assetId}/timeline`}
      className="text-blue-600 underline hover:text-blue-800 print:text-black print:no-underline"
    >
      {safe(label)}
    </Link>
  );
};

function parseCursorMeta(meta) {
  const nextCursor =
    typeof meta?.nextCursor === "string" && meta.nextCursor.trim() !== ""
      ? meta.nextCursor
      : null;

  return {
    hasMore: Boolean(meta?.hasMore),
    nextCursor,
  };
}

export default function EmployeeIssuedStatement() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );
  const custodianType = useMemo(() => {
    const raw = String(queryParams.get("custodianType") || "")
      .trim()
      .toUpperCase();
    if (CUSTODIAN_TYPES.has(raw)) return raw;
    return inferCustodianTypeFromId(id);
  }, [id, queryParams]);
  const subjectId = id ? decodeURIComponent(String(id)) : "";
  const requestedMode = useMemo(() => {
    const raw = String(queryParams.get("mode") || "")
      .trim()
      .toUpperCase();
    return raw === "CURRENT" ? "CURRENT" : "HISTORY";
  }, [queryParams]);
  const lockCurrentMode = requestedMode === "CURRENT";

  const [employee, setEmployee] = useState(null);
  const [issuedItems, setIssuedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [printTimestamp, setPrintTimestamp] = useState("");
  const [preparedBy, setPreparedBy] = useState("Login Name");
  const [reportType, setReportType] = useState("ALL");
  const [statementMode, setStatementMode] = useState(requestedMode);

  useEffect(() => {
    const storedUser = localStorage.getItem("fullname");
    if (storedUser) setPreparedBy(storedUser);
  }, []);

  useEffect(() => {
    setStatementMode(requestedMode);
  }, [requestedMode]);

  const fetchIssuedItemsByCursor = useCallback(async (currentOnly = false) => {
    const all = [];
    let cursor = null;
    let hasMore = true;
    const seenCursors = new Set();

    while (hasMore && all.length < MAX_STATEMENT_ROWS) {
      const params = {
        limit: ISSUED_PAGE_SIZE,
        cursorMode: true,
        cursor: cursor || undefined,
        currentOnly: currentOnly || undefined,
      };
      if (custodianType) {
        params.custodianId = subjectId;
        params.custodianType = custodianType;
      } else {
        params.employeeId = subjectId;
      }

      const issuedRes = await axios.get(`${API_BASE}/issued-items`, { params });

      const rows = issuedRes.data?.data || [];
      all.push(...rows);

      const meta = parseCursorMeta(issuedRes.data?.meta || {});
      cursor = meta.nextCursor;

      if (cursor) {
        if (seenCursors.has(cursor)) {
          hasMore = false;
        } else {
          seenCursors.add(cursor);
          hasMore = meta.hasMore && Boolean(cursor);
        }
      } else {
        hasMore = false;
      }
    }

    return {
      rows: all.slice(0, MAX_STATEMENT_ROWS),
      truncated: hasMore,
    };
  }, [custodianType, subjectId]);

  useEffect(() => {
    async function fetchAll() {
      if (!subjectId) return;

      try {
        setLoading(true);

        const subjectRequest =
          custodianType && custodianType !== "EMPLOYEE"
            ? axios.get(`${API_BASE}/custodians/${encodeURIComponent(subjectId)}`)
            : axios
                .get(`${API_BASE}/employee/${encodeURIComponent(subjectId)}`)
                .catch(async () =>
                  axios.get(`${API_BASE}/custodians/${encodeURIComponent(subjectId)}`),
                );

        const [subjectRes, issuedResult] = await Promise.all([
          subjectRequest,
          fetchIssuedItemsByCursor(statementMode === "CURRENT"),
        ]);

        const raw = subjectRes?.data?.data || null;
        if (raw && (raw.emp_id || raw.email_id || raw.mobile_no)) {
          setEmployee(raw);
        } else {
          setEmployee({
            emp_id: raw?.id || subjectId,
            name: raw?.display_name || "-",
            designation: raw?.custodian_type || custodianType || "-",
            division: raw?.custodian_type || custodianType || "-",
            email_id: "-",
            mobile_no: "-",
            office_location: "-",
          });
        }
        setIssuedItems(issuedResult.rows);
        setTruncated(issuedResult.truncated);
      } catch (error) {
        console.error("Failed to load statement:", error);
        setEmployee(null);
        setIssuedItems([]);
        setTruncated(false);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [custodianType, fetchIssuedItemsByCursor, statementMode, subjectId]);

  const handlePrint = () => {
    const now = new Date();
    setPrintTimestamp(now.toLocaleString());
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const { rows, totalAssets, totalConsumables } = useMemo(() => {
    const flattened = [];

    issuedItems.forEach((item) => {
      if (item.serialized && Array.isArray(item.assets) && item.assets.length) {
        const allHistoricalNoSerial = item.assets.every(
          (asset) => asset?.serial_missing_migration,
        );

        if (allHistoricalNoSerial) {
          flattened.push({
            item_name: item.item_name,
            category_name: item.category_name,
            type: "Asset",
            quantity: item.assets.length,
            asset_id: null,
            asset_tag: "-",
            serial_number: "Migrated data (Serial number not available)",
            status_label: "-",
            issue_date: item.date,
          });
        } else {
          item.assets.forEach((asset) => {
            flattened.push({
              item_name: item.item_name,
              category_name: item.category_name,
              type: "Asset",
              quantity: 1,
              asset_id: asset.asset_id ?? asset.id ?? null,
              asset_tag: asset.asset_tag || "-",
              serial_number: asset.serial_number || "-",
              status_label: asset.relationship_status_label || asset.status || "-",
              issue_date: item.date,
            });
          });
        }
      } else {
        flattened.push({
          item_name: item.item_name,
          category_name: item.category_name,
          type: "Consumable",
          quantity: item.quantity || 0,
          asset_id: null,
          asset_tag: "-",
          serial_number: "-",
          status_label: "-",
          issue_date: item.date,
        });
      }
    });

    const filtered =
      reportType === "ASSET"
        ? flattened.filter((row) => row.type === "Asset")
        : reportType === "CONSUMABLE"
          ? flattened.filter((row) => row.type === "Consumable")
          : flattened;

    const filteredAssets = filtered.filter(
      (row) => row.type === "Asset",
    ).length;
    const filteredConsumables = filtered
      .filter((row) => row.type === "Consumable")
      .reduce((sum, row) => sum + Number(row.quantity || 0), 0);

    return {
      rows: filtered.map((row, index) => ({ ...row, sr: index + 1 })),
      totalAssets: reportType === "CONSUMABLE" ? 0 : filteredAssets,
      totalConsumables: reportType === "ASSET" ? 0 : filteredConsumables,
    };
  }, [issuedItems, reportType]);
  const subjectLabel =
    custodianType === "DIVISION"
      ? "Division"
      : custodianType === "VEHICLE"
        ? "Vehicle"
        : "Employee";

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <video
          src={loaderVideo}
          autoPlay
          loop
          muted
          playsInline
          className="h-40 w-40"
        />
      </div>
    );
  }

  return (
    <div className="print-container">
      <button
        className="mb-4 rounded bg-black px-4 py-2 text-white hover:bg-zinc-600 print:hidden"
        onClick={() => navigate(-1)}
      >
        Back
      </button>

      <div className="print-watermark">
        <span>
          ISSUED ITEMS
          <br />
          SYSTEM GENERATED
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
          {statementMode === "CURRENT"
            ? "Current Holding Statement"
            : "Issued Items Statement"}
        </h2>

        {!lockCurrentMode && (
          <div className="print:hidden mb-4 flex items-center justify-center gap-2">
            <button
              onClick={() => setStatementMode("HISTORY")}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                statementMode === "HISTORY"
                  ? "border-slate-700 bg-slate-700 text-white"
                  : "bg-white text-gray-700"
              }`}
            >
              Issue History
            </button>
            <button
              onClick={() => setStatementMode("CURRENT")}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                statementMode === "CURRENT"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "bg-white text-gray-700"
              }`}
            >
              Current Holding Report
            </button>
          </div>
        )}

        <div className="print:hidden mb-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setReportType("ALL")}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              reportType === "ALL"
                ? "border-blue-600 bg-blue-600 text-white"
                : "bg-white text-gray-700"
            }`}
          >
            All Items
          </button>
          <button
            onClick={() => setReportType("ASSET")}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              reportType === "ASSET"
                ? "border-blue-600 bg-blue-600 text-white"
                : "bg-white text-gray-700"
            }`}
          >
            Assets Only
          </button>
          <button
            onClick={() => setReportType("CONSUMABLE")}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              reportType === "CONSUMABLE"
                ? "border-blue-600 bg-blue-600 text-white"
                : "bg-white text-gray-700"
            }`}
          >
            Consumables Only
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
          <div className="col-span-2 rounded border p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <strong>{subjectLabel} Name:</strong> {safe(employee?.name)}
              </div>
              <div>
                <strong>{subjectLabel} ID:</strong> {safe(employee?.emp_id)}
              </div>
              <div>
                <strong>Designation:</strong> {safe(employee?.designation)}
              </div>
              <div>
                <strong>Gender:</strong> {safe(employee?.gender)}
              </div>
              <div>
                <strong>Division:</strong> {safe(employee?.division)}
              </div>
              <div>
                <strong>Email:</strong> {safe(employee?.email_id)}
              </div>
              <div>
                <strong>Mobile:</strong> {safe(employee?.mobile_no)}
              </div>
              <div className="col-span-2">
                <strong>Office Location:</strong>{" "}
                {safe(employee?.office_location)}
              </div>
            </div>
          </div>

          <div className="rounded border p-3">
            <div className="space-y-2">
              <div>
                <strong>Statement Scope:</strong>{" "}
                {statementMode === "CURRENT"
                  ? `Currently Held by ${subjectLabel}`
                  : "Issue History"}
              </div>
              <div>
                <strong>Report Type:</strong>{" "}
                {reportType === "ALL"
                  ? "All Items"
                  : reportType === "ASSET"
                    ? "Assets Only"
                    : "Consumables Only"}
              </div>
              <div>
                <strong>Total Assets:</strong> {totalAssets}
              </div>
              <div>
                <strong>Total Consumables:</strong> {totalConsumables}
              </div>
              {truncated && (
                <div className="text-xs text-amber-700">
                  Data capped at {MAX_STATEMENT_ROWS} rows.
                </div>
              )}
            </div>
          </div>
        </div>

        <table className="w-full border border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-1">#</th>
              <th className="border p-1">Item Name</th>
              <th className="border p-1">Category</th>
              <th className="border p-1">Type</th>
              <th className="border p-1">Qty</th>
              <th className="border p-1">Asset Tag</th>
              <th className="border p-1">Serial No</th>
              <th className="border p-1">Issue Date</th>
              <th className="border p-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="border p-2 text-center" colSpan={9}>
                  {statementMode === "CURRENT"
                    ? `No items are currently held by this ${subjectLabel.toLowerCase()}.`
                    : `No items issued to this ${subjectLabel.toLowerCase()}.`}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.sr}>
                <td className="border p-1">{row.sr}</td>
                <td className="border p-1">{safe(row.item_name)}</td>
                <td className="border p-1">{safe(row.category_name)}</td>
                <td className="border p-1">{row.type}</td>
                <td className="border p-1">{row.quantity}</td>
                <td className="border p-1">
                  {renderAssetLink(row.asset_id, row.asset_tag)}
                </td>
                <td className="border p-1">
                  {renderAssetLink(row.asset_id, row.serial_number)}
                </td>
                <td className="border p-1">
                  {row.issue_date
                    ? new Date(row.issue_date).toLocaleDateString()
                    : "-"}
                </td>
                <td className="border p-1">
                  {renderTimelineLink(row.asset_id, row.status_label)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="print-only display-block-force mt-4 flex flex-row justify-between">
        <div className="text-sm leading-tight">
          <p className="m-0">
            <strong>Prepared By:</strong> {preparedBy}
          </p>
          {printTimestamp && (
            <p className="m-0">
              <strong>Printed On:</strong> {printTimestamp}
            </p>
          )}
        </div>
      </div>

      <div className="print:hidden mt-6 flex gap-3">
        <button
          onClick={handlePrint}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Print Statement
        </button>
      </div>
    </div>
  );
}
