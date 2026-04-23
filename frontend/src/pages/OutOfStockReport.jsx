import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import logo from "/logo.svg";
import { toStoreApiUrl } from "@/lib/api-config";

const formatDateTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const normalizeText = (value) => String(value || "").trim();

const matchesSearch = (row, searchTerm) => {
  const q = normalizeText(searchTerm).toLowerCase();
  if (!q) return true;
  return [
    row.item_name,
    row.category_name,
    row.group_name,
    row.head_name,
    row.status,
    row.type_label,
    row.sku_unit,
  ].some((value) => String(value || "").toLowerCase().includes(q));
};

const filterRowsByMode = (rows, mode) => {
  if (mode === "out-only") {
    return rows.filter((row) => row.status === "Out of Stock");
  }
  if (mode === "low-only") {
    return rows.filter((row) => row.status === "Low Stock");
  }
  if (mode === "risk-only") {
    return rows.filter(
      (row) => row.status === "Out of Stock" || row.status === "Low Stock",
    );
  }
  return rows;
};

function StatusChip({ status }) {
  if (status === "Out of Stock") {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Out of Stock
      </span>
    );
  }
  if (status === "Low Stock") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        Low Stock
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      Available
    </span>
  );
}

function SummaryCard({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white text-slate-800",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  };

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

export default function OutOfStockReport() {
  const [report, setReport] = useState({
    rows: [],
    summary: null,
    critical_categories: [],
    generated_at: null,
  });
  const [mode, setMode] = useState("risk-only");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preparedBy, setPreparedBy] = useState("Login Name");
  const [printTimestamp, setPrintTimestamp] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("fullname");
    if (storedUser) setPreparedBy(storedUser);
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(toStoreApiUrl("/reports/out-of-stock"));
      const payload = res?.data?.data || {};
      setReport({
        rows: Array.isArray(payload?.rows) ? payload.rows : [],
        summary: payload?.summary || null,
        critical_categories: Array.isArray(payload?.critical_categories)
          ? payload.critical_categories
          : [],
        generated_at: payload?.generated_at || new Date().toISOString(),
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load stock report.",
      );
      setReport({
        rows: [],
        summary: null,
        critical_categories: [],
        generated_at: null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const filteredRows = useMemo(() => {
    return filterRowsByMode(report.rows, mode).filter((row) =>
      matchesSearch(row, search),
    );
  }, [report.rows, mode, search]);

  const filteredSummary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.total_items += 1;
        if (row.status === "Out of Stock") acc.out_count += 1;
        else if (row.status === "Low Stock") acc.low_count += 1;
        else acc.available_count += 1;
        acc.category_ids.add(row.category_id);
        acc.group_ids.add(row.group_id);
        acc.head_ids.add(row.head_id);
        return acc;
      },
      {
        total_items: 0,
        out_count: 0,
        low_count: 0,
        available_count: 0,
        category_ids: new Set(),
        group_ids: new Set(),
        head_ids: new Set(),
      },
    );
  }, [filteredRows]);

  const visibleCriticalCategories = useMemo(() => {
    const categories = [...filteredRows.reduce((map, row) => {
      const key = row.category_id || row.category_name;
      const current = map.get(key) || {
        category_id: row.category_id,
        category_name: row.category_name,
        group_name: row.group_name,
        head_name: row.head_name,
        total_items: 0,
        out_count: 0,
        low_count: 0,
        available_count: 0,
      };
      current.total_items += 1;
      if (row.status === "Out of Stock") current.out_count += 1;
      else if (row.status === "Low Stock") current.low_count += 1;
      else current.available_count += 1;
      map.set(key, current);
      return map;
    }, new Map()).values()];

    return categories
      .sort((a, b) => {
        if (b.out_count !== a.out_count) return b.out_count - a.out_count;
        if (b.low_count !== a.low_count) return b.low_count - a.low_count;
        return a.category_name.localeCompare(b.category_name);
      })
      .slice(0, 12);
  }, [filteredRows]);

  const handlePrint = () => {
    setPrintTimestamp(new Date().toLocaleString());
    setTimeout(() => window.print(), 50);
  };

  const reportTitle =
    mode === "out-only"
      ? "Out of Stock Report"
      : mode === "low-only"
        ? "Low Stock Report"
        : mode === "risk-only"
          ? "Risk Stock Report"
          : "Full Stock Health Report";

  return (
    <div className="print-container">
      <div className="print-watermark">
        <span>
          STOCK REPORT
          <br />
          SYSTEM GENERATED
        </span>
      </div>

      <div className="print-content p-4 md:p-6">
        <header className="display-block-force mb-4 flex flex-col items-center justify-between border-b pb-2">
          <img src={logo} alt="Company Logo" className="mt-2 h-20" />
          <h1 className="blockcls flex-1 text-center text-2xl font-bold">
            Haryana State Electronics Development Co-operation Ltd.
          </h1>
          <h2>(Haryana Government Undertaking)</h2>
          <h2>S.C.O. 111-113, SECTOR-17-B, CHANDIGARH - 160017</h2>
        </header>

        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-center text-xl font-semibold md:text-left">
              {reportTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Best-action view of stock health with critical categories and item-level detail.
            </p>
          </div>
          <div className="text-sm text-slate-600">
            <div>
              <strong>Generated On:</strong> {formatDateTime(report.generated_at)}
            </div>
          </div>
        </div>

        <div className="no-print mb-4 flex flex-wrap items-center gap-2 print:hidden">
          <button
            onClick={() => setMode("risk-only")}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              mode === "risk-only"
                ? "border-blue-600 bg-blue-600 text-white"
                : "bg-white text-slate-700"
            }`}
          >
            Risk View
          </button>
          <button
            onClick={() => setMode("out-only")}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              mode === "out-only"
                ? "border-blue-600 bg-blue-600 text-white"
                : "bg-white text-slate-700"
            }`}
          >
            Out of Stock
          </button>
          <button
            onClick={() => setMode("low-only")}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              mode === "low-only"
                ? "border-blue-600 bg-blue-600 text-white"
                : "bg-white text-slate-700"
            }`}
          >
            Low Stock
          </button>
          <button
            onClick={() => setMode("all")}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              mode === "all"
                ? "border-blue-600 bg-blue-600 text-white"
                : "bg-white text-slate-700"
            }`}
          >
            All Items
          </button>
        </div>

        <div className="no-print mb-4 flex flex-wrap items-center gap-2 print:hidden">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by item, category, group, head, type or status..."
            className="min-w-[260px] flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            className="rounded bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            Print Report
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? <div className="mb-4 text-sm">Loading report...</div> : null}

        {!loading ? (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <SummaryCard
                label="Visible Items"
                value={filteredSummary.total_items}
                tone="blue"
              />
              <SummaryCard
                label="Out of Stock"
                value={filteredSummary.out_count}
                tone="red"
              />
              <SummaryCard
                label="Low Stock"
                value={filteredSummary.low_count}
                tone="amber"
              />
              <SummaryCard
                label="Available"
                value={filteredSummary.available_count}
                tone="emerald"
              />
              <SummaryCard
                label="Affected Categories"
                value={[...filteredSummary.category_ids].filter(Boolean).length}
                tone="slate"
              />
            </div>

            <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Critical Categories
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Categories with the highest stock risk right now.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="border-b px-4 py-2">Category</th>
                        <th className="border-b px-4 py-2">Group</th>
                        <th className="border-b px-4 py-2">Head</th>
                        <th className="border-b px-4 py-2 text-right">Out</th>
                        <th className="border-b px-4 py-2 text-right">Low</th>
                        <th className="border-b px-4 py-2 text-right">Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(visibleCriticalCategories.length
                        ? visibleCriticalCategories
                        : report.critical_categories
                      ).map((category) => (
                        <tr key={category.category_id || category.category_name}>
                          <td className="border-b px-4 py-2">{category.category_name}</td>
                          <td className="border-b px-4 py-2">{category.group_name}</td>
                          <td className="border-b px-4 py-2">{category.head_name}</td>
                          <td className="border-b px-4 py-2 text-right font-semibold text-red-700">
                            {category.out_count}
                          </td>
                          <td className="border-b px-4 py-2 text-right font-semibold text-amber-700">
                            {category.low_count}
                          </td>
                          <td className="border-b px-4 py-2 text-right">
                            {category.total_items}
                          </td>
                        </tr>
                      ))}
                      {visibleCriticalCategories.length === 0 &&
                      report.critical_categories.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-6 text-center text-sm text-slate-500"
                          >
                            No category insights available.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">
                  Report Snapshot
                </h3>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <div>
                    <strong>Mode:</strong> {reportTitle}
                  </div>
                  <div>
                    <strong>Search:</strong> {normalizeText(search) || "None"}
                  </div>
                  <div>
                    <strong>Visible Heads:</strong>{" "}
                    {[...filteredSummary.head_ids].filter(Boolean).length}
                  </div>
                  <div>
                    <strong>Visible Groups:</strong>{" "}
                    {[...filteredSummary.group_ids].filter(Boolean).length}
                  </div>
                  <div>
                    <strong>Total System Items:</strong>{" "}
                    {report.summary?.total_items ?? 0}
                  </div>
                  <div>
                    <strong>Total System Out:</strong>{" "}
                    {report.summary?.out_count ?? 0}
                  </div>
                  <div>
                    <strong>Total System Low:</strong>{" "}
                    {report.summary?.low_count ?? 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Item-Level Stock View
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Flat view for fastest review and action.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="border-b px-4 py-2">#</th>
                      <th className="border-b px-4 py-2">Item</th>
                      <th className="border-b px-4 py-2">Category</th>
                      <th className="border-b px-4 py-2">Group</th>
                      <th className="border-b px-4 py-2">Head</th>
                      <th className="border-b px-4 py-2">Type</th>
                      <th className="border-b px-4 py-2 text-right">Qty</th>
                      <th className="border-b px-4 py-2">Unit</th>
                      <th className="border-b px-4 py-2 text-right">Lots</th>
                      <th className="border-b px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, index) => (
                      <tr key={`${row.item_key}-${row.category_id}`}>
                        <td className="border-b px-4 py-2">{index + 1}</td>
                        <td className="border-b px-4 py-2 font-medium text-slate-900">
                          {row.item_name}
                        </td>
                        <td className="border-b px-4 py-2">{row.category_name}</td>
                        <td className="border-b px-4 py-2">{row.group_name}</td>
                        <td className="border-b px-4 py-2">{row.head_name}</td>
                        <td className="border-b px-4 py-2">{row.type_label}</td>
                        <td className="border-b px-4 py-2 text-right font-semibold">
                          {row.quantity}
                        </td>
                        <td className="border-b px-4 py-2">{row.sku_unit}</td>
                        <td className="border-b px-4 py-2 text-right">{row.lot_count}</td>
                        <td className="border-b px-4 py-2">
                          <StatusChip status={row.status} />
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 py-8 text-center text-sm text-slate-500"
                        >
                          No items match the current report filters.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className="print-only display-block-force mt-4 flex flex-row justify-between">
        <div className="text-sm leading-tight">
          <p className="m-0">
            <strong>Prepared By:</strong> {preparedBy}
          </p>
          {printTimestamp ? (
            <p className="m-0">
              <strong>Printed On:</strong> {printTimestamp}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
