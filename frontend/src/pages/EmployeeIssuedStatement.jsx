import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import logo from "/logo.svg";
import loaderVideo from "../assets/Paperplane.webm";

const API_BASE = "http://localhost:3000/api/v1";
const ISSUED_PAGE_SIZE = 500;
const MAX_STATEMENT_ROWS = 50000;

const safe = (value) => (value == null || value === "" ? "-" : value);

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
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [issuedItems, setIssuedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [printTimestamp, setPrintTimestamp] = useState("");
  const [preparedBy, setPreparedBy] = useState("Login Name");
  const [reportType, setReportType] = useState("ALL");
  const [statementMode, setStatementMode] = useState("HISTORY");

  useEffect(() => {
    const storedUser = localStorage.getItem("fullname");
    if (storedUser) setPreparedBy(storedUser);
  }, []);

  const fetchIssuedItemsByCursor = useCallback(async (employeeId, currentOnly = false) => {
    const all = [];
    let cursor = null;
    let hasMore = true;
    const seenCursors = new Set();

    while (hasMore && all.length < MAX_STATEMENT_ROWS) {
      const issuedRes = await axios.get(`${API_BASE}/issued-items`, {
        params: {
          employeeId,
          limit: ISSUED_PAGE_SIZE,
          cursorMode: true,
          cursor: cursor || undefined,
          currentOnly: currentOnly || undefined,
        },
      });

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
  }, []);

  useEffect(() => {
    async function fetchAll() {
      if (!id) return;

      try {
        setLoading(true);

        const [empRes, issuedResult] = await Promise.all([
          axios.get(`${API_BASE}/employee/${id}`),
          fetchIssuedItemsByCursor(id, statementMode === "CURRENT"),
        ]);

        setEmployee(empRes.data?.data || null);
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
  }, [fetchIssuedItemsByCursor, id, statementMode]);

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
        item.assets.forEach((asset) => {
          flattened.push({
            item_name: item.item_name,
            category_name: item.category_name,
            type: "Asset",
            quantity: 1,
            asset_tag: asset.asset_tag || "-",
            serial_number: asset.serial_number || "-",
            issue_date: item.date,
          });
        });
      } else {
        flattened.push({
          item_name: item.item_name,
          category_name: item.category_name,
          type: "Consumable",
          quantity: item.quantity || 0,
          asset_tag: "-",
          serial_number: "-",
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
                <strong>Employee Name:</strong> {safe(employee?.name)}
              </div>
              <div>
                <strong>Employee ID:</strong> {safe(employee?.emp_id)}
              </div>
              <div>
                <strong>Designation:</strong> {safe(employee?.designation)}
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
                  ? "Currently Held by Employee"
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
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="border p-2 text-center" colSpan={8}>
                  {statementMode === "CURRENT"
                    ? "No items are currently held by this employee."
                    : "No items issued to this employee."}
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
                <td className="border p-1">{safe(row.asset_tag)}</td>
                <td className="border p-1">{safe(row.serial_number)}</td>
                <td className="border p-1">
                  {row.issue_date
                    ? new Date(row.issue_date).toLocaleDateString()
                    : "-"}
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
