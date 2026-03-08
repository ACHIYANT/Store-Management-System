import React from "react";
import { Link } from "react-router-dom";
import MotionGrid from "@/components/MotionGrid";
import UserMiniTrendChart from "@/components/dashboard/user/UserMiniTrendChart";

const statusToneMap = {
  Draft: "bg-slate-100 text-slate-700",
  Submitted: "bg-blue-100 text-blue-700",
  InReview: "bg-indigo-100 text-indigo-700",
  PartiallyApproved: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Fulfilling: "bg-cyan-100 text-cyan-700",
  Fulfilled: "bg-green-100 text-green-700",
  Rejected: "bg-rose-100 text-rose-700",
  Cancelled: "bg-zinc-100 text-zinc-700",
};

const progressByStatus = {
  Draft: 12,
  Submitted: 30,
  InReview: 48,
  PartiallyApproved: 64,
  Approved: 80,
  Fulfilling: 92,
  Fulfilled: 100,
  Rejected: 100,
  Cancelled: 100,
};

const formatNumber = (n) =>
  new Intl.NumberFormat("en-IN").format(Number(n || 0));

const formatDateTime = (value) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
};

function KpiTile({ label, value, tone = "slate" }) {
  const toneMap = {
    teal: "border-teal-200 bg-teal-50 text-teal-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    red: "border-rose-200 bg-rose-50 text-rose-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
  };

  return (
    <div
      className={`rounded-xl border px-4 py-3 shadow-sm ${
        toneMap[tone] || toneMap.slate
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider opacity-75">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{formatNumber(value)}</div>
    </div>
  );
}

function StatusChip({ status }) {
  const normalized = String(status || "-");
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
        statusToneMap[normalized] || "bg-slate-100 text-slate-700"
      }`}
    >
      {normalized}
    </span>
  );
}

function RequisitionRow({ row }) {
  const totals = row?.totals || {};
  const status = String(row?.status || "-");
  const progress = Number(progressByStatus[status] || 0);
  const stageLabel =
    row.current_stage_role_display ||
    row.current_stage_role ||
    (["Approved", "PartiallyApproved", "Fulfilling", "Fulfilled"].includes(status)
      ? "STORE_ENTRY"
      : "-");

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">
            {row.req_no || `REQ-${row.id}`}
          </div>
          <div className="truncate text-xs text-slate-500">
            {row.purpose || "No purpose provided"}
          </div>
        </div>
        <StatusChip status={status} />
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-teal-500 transition-all"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span>Stage: {stageLabel}</span>
        <span>Req: {formatNumber(totals.requested_qty || 0)}</span>
        <span>Appr: {formatNumber(totals.approved_qty || 0)}</span>
        <span>Updated: {formatDateTime(row.updatedAt)}</span>
      </div>
    </div>
  );
}

function RequisitionListCard({ title, rows, emptyMessage }) {
  const safeRows = Array.isArray(rows) ? rows : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      <div className="space-y-2.5">
        {safeRows.length === 0 ? (
          <div className="text-sm text-slate-500">{emptyMessage}</div>
        ) : (
          safeRows.map((row) => <RequisitionRow key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}

function DashboardHeader({ refreshing, lastUpdatedAt }) {
  const fullname = localStorage.getItem("fullname") || "User";

  return (
    <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-cyan-50 to-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">
            Welcome, {fullname}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Employee Dashboard focused on your requisition workflow and action items.
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {refreshing && (
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-cyan-700">
              Refreshing...
            </span>
          )}
          <span>
            Updated: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "-"}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/requisitions"
          className="inline-flex items-center rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          Create Requisition
        </Link>
        <Link
          to="/requisitions/store-queue"
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Requisition Queue
        </Link>
        <Link
          to="/requisitions/inbox"
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Requisition History
        </Link>
      </div>
    </div>
  );
}

function ActionNeededCard({ rows = [] }) {
  const safeRows = Array.isArray(rows) ? rows : [];

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-amber-900">Action Needed</h3>
      <div className="space-y-2">
        {safeRows.length === 0 && (
          <div className="text-sm text-amber-800/80">No immediate action pending.</div>
        )}
        {safeRows.map((row) => (
          <div
            key={row.id}
            className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-800">{row.req_no}</span>
              <StatusChip status={row.status} />
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {row.purpose || "No purpose provided"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DelayIndicatorCard({ pending = {} }) {
  const avgDays = Number(pending?.avg_days || 0);
  const maxDays = Number(pending?.max_days || 0);

  const healthLabel = avgDays <= 1 ? "Healthy" : avgDays <= 3 ? "Watch" : "Delayed";
  const healthTone = avgDays <= 1 ? "text-emerald-700" : avgDays <= 3 ? "text-amber-700" : "text-rose-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">Approval Delay Indicator</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Avg Pending</div>
          <div className="mt-1 text-2xl font-semibold text-slate-800">{avgDays.toFixed(1)}d</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Max Pending</div>
          <div className="mt-1 text-2xl font-semibold text-slate-800">{maxDays.toFixed(1)}d</div>
        </div>
      </div>
      <div className={`mt-3 text-xs font-medium ${healthTone}`}>Status: {healthLabel}</div>
    </div>
  );
}

function RecentActionUpdatesCard({ rows = [] }) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const fmtQty = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "-";
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(3).replace(/\.?0+$/, "");
  };

  const actionTone = (action) => {
    const normalized = String(action || "").toLowerCase();
    if (["reject", "cancel"].includes(normalized)) return "bg-rose-100 text-rose-700";
    if (["approve", "forward", "fulfill"].includes(normalized))
      return "bg-emerald-100 text-emerald-700";
    if (["qtyreduce", "mapitem"].includes(normalized))
      return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">
        Recent Requisition Updates
      </h3>
      <div className="space-y-2.5">
        {safeRows.length === 0 && (
          <div className="text-sm text-slate-500">No recent updates available.</div>
        )}
        {safeRows.map((row) => (
          <div
            key={row.id}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-800">
                {row.req_no || `REQ-${row.requisition_id || "-"}`}
              </div>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${actionTone(
                  row.action,
                )}`}
              >
                {row.action || "Update"}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              By: {row.acted_by_name || "System"} ({row.acted_by_role || "-"})
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Stage: {row.stage_role_display || row.stage_role || "-"} | At:{" "}
              {formatDateTime(row.action_at)}
            </div>
            {row.requisition_item_id ? (
              <div className="mt-1 text-xs text-slate-500">
                Item: {row.item_no ? `#${row.item_no}` : "-"}{" "}
                {row.item_particulars ? `| ${row.item_particulars}` : ""}
              </div>
            ) : null}
            {String(row.action || "").toLowerCase() === "qtyreduce" &&
            row.before_qty != null &&
            row.after_qty != null ? (
              <div className="mt-1 text-xs font-medium text-amber-700">
                Qty Reduced: {fmtQty(row.before_qty)} → {fmtQty(row.after_qty)}
                {row.item_sku_unit ? ` ${row.item_sku_unit}` : ""}
                {row.reduced_by_qty != null
                  ? ` (reduced by ${fmtQty(row.reduced_by_qty)})`
                  : ""}
              </div>
            ) : null}
            {row.remarks ? (
              <div className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                {row.remarks}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UserDashboardWidgets({
  summary = null,
  refreshing = false,
  lastUpdatedAt = null,
}) {
  const safeSummary = summary || {};
  const counts = safeSummary.counts || {};
  const recentActionRows = Array.isArray(safeSummary.recent_actions)
    ? safeSummary.recent_actions
    : [];

  return (
    <div className="mt-6 space-y-6">
      <DashboardHeader refreshing={refreshing} lastUpdatedAt={lastUpdatedAt} />

      <MotionGrid className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiTile label="My Requisitions" value={counts.total || 0} tone="blue" />
        <KpiTile label="In Workflow" value={counts.workflow || 0} tone="amber" />
        <KpiTile label="Approved/Partial" value={counts.approved_like || 0} tone="green" />
        <KpiTile label="Rejected/Cancelled" value={counts.rejected_cancelled || 0} tone="red" />
        <KpiTile label="Fulfilled" value={counts.fulfilled || 0} tone="teal" />
        <KpiTile label="Worked by Me" value={counts.worked_by_me || 0} tone="slate" />
      </MotionGrid>

      <MotionGrid className="grid grid-cols-1 lg:grid-cols-3 gap-4" stagger={90}>
        <ActionNeededCard rows={safeSummary.action_needed || []} />
        <DelayIndicatorCard pending={safeSummary.pending || {}} />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Monthly Requisition Trend</h3>
          <UserMiniTrendChart trend={safeSummary.monthly_trend || []} />
        </div>
      </MotionGrid>

      <MotionGrid className="grid grid-cols-1 xl:grid-cols-2 gap-4" stagger={95}>
        <RequisitionListCard
          title="My Requisition Queue"
          rows={safeSummary.queue || []}
          emptyMessage="No requisitions are pending in workflow."
        />
        <RequisitionListCard
          title="My Requisition History"
          rows={safeSummary.history || []}
          emptyMessage="No processed requisitions found."
        />
      </MotionGrid>

      <RecentActionUpdatesCard rows={recentActionRows} />
    </div>
  );
}
