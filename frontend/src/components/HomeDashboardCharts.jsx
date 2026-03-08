import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import axios from "axios";
import MotionGrid from "@/components/MotionGrid";

const API_BASE = "http://localhost:3000/api/v1";
const UserDashboardWidgets = lazy(
  () => import("@/components/dashboard/user/UserDashboardWidgets"),
);

const formatNumber = (n) =>
  new Intl.NumberFormat("en-IN").format(Number(n || 0));

const formatDateTime = (value) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
};

const getStockStatus = (qty) => {
  const n = Number(qty || 0);
  if (n === 0) return "Out of Stock";
  if (n <= 5) return "Low Stock";
  return "Available";
};

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function readStoredRoles() {
  try {
    const fromRoles = JSON.parse(localStorage.getItem("roles") || "[]");
    if (Array.isArray(fromRoles) && fromRoles.length) {
      return fromRoles.map(normalizeRole).filter(Boolean);
    }
  } catch {
    // ignore parse error
  }

  try {
    const me = JSON.parse(localStorage.getItem("me") || "null");
    if (Array.isArray(me?.roles)) {
      return me.roles.map(normalizeRole).filter(Boolean);
    }
    if (typeof me?.roles === "string" && me.roles.trim()) {
      return [normalizeRole(me.roles)];
    }
  } catch {
    // ignore parse error
  }

  return [];
}

function KpiCard({ label, value, tone = "blue" }) {
  const tones = {
    blue: "from-blue-50 to-blue-100 text-blue-800",
    green: "from-emerald-50 to-emerald-100 text-emerald-800",
    amber: "from-amber-50 to-amber-100 text-amber-800",
    red: "from-rose-50 to-rose-100 text-rose-800",
    purple: "from-violet-50 to-violet-100 text-violet-800",
    slate: "from-slate-50 to-slate-100 text-slate-800",
  };

  return (
    <div
      className={`rounded-xl border bg-gradient-to-br p-4 shadow-sm ${
        tones[tone] || tones.blue
      }`}
    >
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{formatNumber(value)}</div>
    </div>
  );
}

function UserDashboardSkeleton() {
  return (
    <div className="mt-6 space-y-4">
      <div className="h-24 animate-pulse rounded-2xl border bg-slate-100" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="h-20 animate-pulse rounded-xl border bg-slate-100"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="h-56 animate-pulse rounded-2xl border bg-slate-100"
          />
        ))}
      </div>
    </div>
  );
}

export default function HomeDashboardCharts() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState([]);

  const [stocks, setStocks] = useState([]);
  const [daybooks, setDaybooks] = useState([]);
  const [assets, setAssets] = useState([]);
  const [vendorsCount, setVendorsCount] = useState(0);
  const [employeesCount, setEmployeesCount] = useState(0);
  const [categoriesCount, setCategoriesCount] = useState(0);
  const [recentEvents, setRecentEvents] = useState([]);

  const [userSummary, setUserSummary] = useState(null);
  const [userRefreshing, setUserRefreshing] = useState(false);
  const [lastUserRefreshAt, setLastUserRefreshAt] = useState(null);

  const normalizedRoles = useMemo(
    () => Array.from(new Set((roles || []).map(normalizeRole).filter(Boolean))),
    [roles],
  );

  const isUserOnlyDashboard = useMemo(
    () =>
      normalizedRoles.length > 0 &&
      normalizedRoles.every((role) => role === "USER"),
    [normalizedRoles],
  );

  const fetchUserSummary = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setUserRefreshing(true);
    }

    try {
      const res = await axios.get(
        `${API_BASE}/requisitions/dashboard/my-summary`,
        {
          params: {
            queueLimit: 8,
            historyLimit: 8,
            recentLimit: 8,
            actionNeededLimit: 6,
            months: 6,
          },
        },
      );

      setUserSummary(res?.data?.data || null);
      setLastUserRefreshAt(new Date().toISOString());
    } catch {
      if (!silent) {
        setUserSummary(null);
      }
    } finally {
      if (silent) {
        setUserRefreshing(false);
      }
    }
  }, []);

  const fetchOperationalDashboard = useCallback(async () => {
    const [
      stocksRes,
      daybookRes,
      assetsRes,
      vendorRes,
      employeeRes,
      categoryRes,
      recentRes,
    ] = await Promise.allSettled([
      axios.get(`${API_BASE}/stocks-by-category`),
      axios.get(`${API_BASE}/daybook`),
      axios.get(`${API_BASE}/assets`),
      axios.get(`${API_BASE}/vendor`),
      axios.get(`${API_BASE}/employee`),
      axios.get(`${API_BASE}/itemCategories`),
      axios.get(`${API_BASE}/asset-events/recent`, { params: { limit: 8 } }),
    ]);

    setStocks(
      stocksRes.status === "fulfilled" ? stocksRes.value.data?.data || [] : [],
    );
    setDaybooks(
      daybookRes.status === "fulfilled"
        ? daybookRes.value.data?.data || []
        : [],
    );
    setAssets(
      assetsRes.status === "fulfilled" ? assetsRes.value.data?.data || [] : [],
    );
    setVendorsCount(
      vendorRes.status === "fulfilled"
        ? (vendorRes.value.data?.data || []).length
        : 0,
    );
    setEmployeesCount(
      employeeRes.status === "fulfilled"
        ? (employeeRes.value.data?.data || []).length
        : 0,
    );
    setCategoriesCount(
      categoryRes.status === "fulfilled"
        ? (categoryRes.value.data?.data || []).length
        : 0,
    );
    setRecentEvents(
      recentRes.status === "fulfilled" ? recentRes.value.data?.data || [] : [],
    );
  }, []);

  useEffect(() => {
    let alive = true;
    let intervalId = null;

    async function initialize() {
      setLoading(true);

      const resolvedRoles = readStoredRoles();
      if (!alive) return;
      setRoles(resolvedRoles);

      const userOnly =
        resolvedRoles.length > 0 &&
        resolvedRoles.every((role) => normalizeRole(role) === "USER");

      if (userOnly) {
        await fetchUserSummary({ silent: false });
        if (!alive) return;

        intervalId = setInterval(() => {
          if (!alive) return;
          fetchUserSummary({ silent: true });
        }, 60 * 1000);
      } else {
        await fetchOperationalDashboard();
        if (!alive) return;
      }

      setLoading(false);
    }

    initialize();

    return () => {
      alive = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchOperationalDashboard, fetchUserSummary]);

  const derived = useMemo(() => {
    const totalStockQty = stocks.reduce(
      (sum, r) => sum + Number(r.total_quantity || 0),
      0,
    );

    const statusCounts = {
      "Out of Stock": 0,
      "Low Stock": 0,
      Available: 0,
    };

    const topCats = stocks
      .map((r) => ({
        name: r.category_name || "Unknown",
        qty: Number(r.total_quantity || 0),
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    stocks.forEach((r) => {
      const status = getStockStatus(r.total_quantity);
      statusCounts[status] += 1;
    });

    const assetStatusCounts = assets.reduce((acc, a) => {
      const key = a.status || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const now = new Date();
    const monthKeys = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-US", {
        month: "short",
        year: "2-digit",
      });
      monthKeys.push({ key, label });
    }

    const daybookAmountByMonth = {};
    daybooks.forEach((d) => {
      const raw = d.bill_date || d.createdAt;
      if (!raw) return;
      const dt = new Date(raw);
      if (Number.isNaN(dt.getTime())) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      daybookAmountByMonth[key] =
        (daybookAmountByMonth[key] || 0) + Number(d.total_amount || 0);
    });

    const monthLabels = monthKeys.map((m) => m.label);
    const monthAmountValues = monthKeys.map(
      (m) => daybookAmountByMonth[m.key] || 0,
    );

    const statusOrder = [
      "Approved",
      "Pending",
      "Rejected",
      "Cancelled",
      "MRN Cancelled",
      "Unknown",
    ];

    const statusSeries = {};
    statusOrder.forEach((s) => {
      statusSeries[s] = new Array(monthKeys.length).fill(0);
    });

    daybooks.forEach((d) => {
      const raw = d.bill_date || d.createdAt;
      if (!raw) return;
      const dt = new Date(raw);
      if (Number.isNaN(dt.getTime())) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const idx = monthKeys.findIndex((m) => m.key === key);
      if (idx === -1) return;
      const status = d.status || "Unknown";
      if (!statusSeries[status]) {
        statusSeries[status] = new Array(monthKeys.length).fill(0);
      }
      statusSeries[status][idx] += 1;
    });

    const monthStatusSeries = Object.keys(statusSeries).map((name) => ({
      name,
      data: statusSeries[name],
    }));

    const lowCategories = stocks
      .map((r) => ({
        name: r.category_name || "Unknown",
        qty: Number(r.total_quantity || 0),
      }))
      .filter((r) => r.qty <= 5)
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 8);

    return {
      totalStockQty,
      statusCounts,
      lowCategories,
      topCats,
      assetStatusCounts,
      monthLabels,
      monthAmountValues,
      monthStatusSeries,
    };
  }, [stocks, daybooks, assets]);

  const stockDonut = {
    tooltip: { trigger: "item" },
    legend: { bottom: 0 },
    series: [
      {
        type: "pie",
        radius: ["55%", "75%"],
        label: { formatter: "{b}\\n{c}" },
        data: Object.entries(derived.statusCounts).map(([name, value]) => ({
          name,
          value,
        })),
        color: ["#ef4444", "#f59e0b", "#22c55e"],
      },
    ],
  };

  const topBar = {
    tooltip: { trigger: "axis" },
    grid: { left: 10, right: 10, top: 20, bottom: 40, containLabel: true },
    xAxis: { type: "value" },
    yAxis: {
      type: "category",
      data: derived.topCats.map((c) => c.name),
      axisLabel: { width: 140, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        data: derived.topCats.map((c) => c.qty),
        barWidth: 14,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: "#60a5fa" },
            { offset: 1, color: "#22c55e" },
          ]),
        },
      },
    ],
  };

  const daybookValueLine = {
    tooltip: { trigger: "axis" },
    grid: { left: 10, right: 10, top: 20, bottom: 40, containLabel: true },
    xAxis: { type: "category", data: derived.monthLabels },
    yAxis: { type: "value" },
    series: [
      {
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        data: derived.monthAmountValues,
        lineStyle: { width: 3, color: "#0ea5e9" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(14,165,233,0.35)" },
            { offset: 1, color: "rgba(14,165,233,0.02)" },
          ]),
        },
      },
    ],
  };

  const assetDonut = {
    tooltip: { trigger: "item" },
    legend: { bottom: 0 },
    series: [
      {
        type: "pie",
        radius: ["55%", "75%"],
        label: { formatter: "{b}\\n{c}" },
        data: Object.entries(derived.assetStatusCounts).map(
          ([name, value]) => ({
            name,
            value,
          }),
        ),
        color: ["#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#94a3b8"],
      },
    ],
  };

  const availabilityPct = categoriesCount
    ? Math.round((derived.statusCounts.Available / categoriesCount) * 100)
    : 0;

  const availabilityGauge = {
    series: [
      {
        type: "gauge",
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        radius: "100%",
        axisLine: {
          lineStyle: {
            width: 12,
            color: [
              [0.3, "#ef4444"],
              [0.7, "#f59e0b"],
              [1, "#22c55e"],
            ],
          },
        },
        pointer: { show: false },
        progress: { show: true, width: 12, roundCap: true },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 24,
          offsetCenter: [0, "10%"],
          formatter: "{value}%",
          color: "#0f172a",
        },
        data: [{ value: availabilityPct }],
      },
    ],
  };

  const stackedArea = {
    tooltip: { trigger: "axis" },
    legend: { top: 0 },
    grid: { left: 10, right: 10, top: 30, bottom: 40, containLabel: true },
    xAxis: { type: "category", data: derived.monthLabels },
    yAxis: { type: "value" },
    series: derived.monthStatusSeries.map((s, idx) => ({
      name: s.name,
      type: "line",
      stack: "total",
      smooth: true,
      lineStyle: { width: 2 },
      symbol: "none",
      data: s.data,
      areaStyle: {
        opacity: 0.6,
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          {
            offset: 0,
            color: [
              "#60a5fa",
              "#22c55e",
              "#f59e0b",
              "#ef4444",
              "#8b5cf6",
              "#94a3b8",
            ][idx % 6],
          },
          { offset: 1, color: "rgba(255,255,255,0.2)" },
        ]),
      },
    })),
  };

  if (loading) {
    return (
      <div className="mt-6 rounded-xl border bg-white p-6 text-sm text-gray-500">
        Loading dashboard...
      </div>
    );
  }

  if (isUserOnlyDashboard) {
    return (
      <Suspense fallback={<UserDashboardSkeleton />}>
        <UserDashboardWidgets
          summary={userSummary}
          refreshing={userRefreshing}
          lastUpdatedAt={lastUserRefreshAt}
        />
      </Suspense>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <MotionGrid className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard label="Categories" value={categoriesCount} tone="blue" />
        <KpiCard
          label="Total Stock"
          value={derived.totalStockQty}
          tone="green"
        />
        <KpiCard
          label="Low Stock Cats"
          value={derived.statusCounts["Low Stock"]}
          tone="amber"
        />
        <KpiCard
          label="Out of Stock Cats"
          value={derived.statusCounts["Out of Stock"]}
          tone="red"
        />
        <KpiCard
          label="Assets In Store"
          value={derived.assetStatusCounts.InStore || 0}
          tone="green"
        />
        <KpiCard
          label="Assets Issued"
          value={derived.assetStatusCounts.Issued || 0}
          tone="amber"
        />
        <KpiCard label="Vendors" value={vendorsCount} tone="purple" />
        <KpiCard label="Employees" value={employeesCount} tone="slate" />
      </MotionGrid>

      <MotionGrid
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        stagger={90}
      >
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Availability Score
          </h3>
          <ReactECharts option={availabilityGauge} style={{ height: 220 }} />
          <div className="mt-2 text-xs text-gray-500">
            Percentage of categories with healthy stock levels.
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {recentEvents.length === 0 && (
              <div className="text-sm text-gray-500">No recent events</div>
            )}
            {recentEvents.map((ev) => (
              <div
                key={`${ev.id}-${ev.event_type}`}
                className="flex items-start justify-between gap-3 border-b pb-2 last:border-b-0"
              >
                <div className="text-sm">
                  <div className="font-medium text-gray-800">
                    {ev.event_type || "Event"}
                  </div>
                  <div className="text-xs text-gray-500">
                    Asset #{ev.asset_id || "-"}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {formatDateTime(ev.event_date || ev.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Low / Out Categories
          </h3>
          <div className="space-y-2">
            {derived.lowCategories.length === 0 && (
              <div className="text-sm text-gray-500">
                All categories healthy
              </div>
            )}
            {derived.lowCategories.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div className="text-sm font-medium text-gray-700 truncate">
                  {c.name}
                </div>
                <div className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {c.qty}
                </div>
              </div>
            ))}
          </div>
        </div>
      </MotionGrid>

      <MotionGrid
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        stagger={90}
      >
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Stock Health
          </h3>
          <ReactECharts option={stockDonut} style={{ height: 260 }} />
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Top Categories
          </h3>
          <ReactECharts option={topBar} style={{ height: 260 }} />
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Asset Status
          </h3>
          <ReactECharts option={assetDonut} style={{ height: 260 }} />
        </div>
      </MotionGrid>

      <MotionGrid
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        stagger={100}
      >
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            DayBook Value Trend
          </h3>
          <ReactECharts option={daybookValueLine} style={{ height: 260 }} />
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            DayBook Trend (Stacked)
          </h3>
          <ReactECharts option={stackedArea} style={{ height: 260 }} />
        </div>
      </MotionGrid>
    </div>
  );
}
