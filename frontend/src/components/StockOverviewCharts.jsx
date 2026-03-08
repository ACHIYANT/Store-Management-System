import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";

function getStatus(qty) {
  const n = Number(qty || 0);
  if (n === 0) return "Out of Stock";
  if (n <= 5) return "Low Stock";
  return "Available";
}

export default function StockOverviewCharts({ rows = [] }) {
  const { treemapData, donutData, topBars, lowList } = useMemo(() => {
    const statusCount = {
      "Out of Stock": 0,
      "Low Stock": 0,
      Available: 0,
    };

    const list = (rows || []).map((r) => {
      const qty = Number(r.total_quantity || 0);
      const status = getStatus(qty);
      statusCount[status] += 1;
      return {
        name: r.category_name || "Unknown",
        qty,
        status,
      };
    });

    const treemap = list.map((x) => ({
      name: x.name,
      value: x.qty,
    }));

    const donut = Object.entries(statusCount).map(([name, value]) => ({
      name,
      value,
    }));

    const top = [...list].sort((a, b) => b.qty - a.qty).slice(0, 10);

    const low = [...list]
      .filter((x) => x.qty <= 5)
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 8);

    return {
      treemapData: treemap,
      donutData: donut,
      topBars: top,
      lowList: low,
    };
  }, [rows]);

  const treemapOption = {
    tooltip: { formatter: "{b}: {c}" },
    series: [
      {
        type: "treemap",
        data: treemapData,
        roam: false,
        label: { show: true, formatter: "{b}\n{c}" },
        itemStyle: { borderColor: "#fff", borderWidth: 1 },
        color: ["#22c55e", "#60a5fa", "#f59e0b", "#ef4444", "#14b8a6"],
      },
    ],
  };

  const donutOption = {
    tooltip: { trigger: "item" },
    legend: { bottom: 0 },
    series: [
      {
        name: "Stock Health",
        type: "pie",
        radius: ["55%", "75%"],
        label: { show: true, formatter: "{b}\n{c}" },
        data: donutData,
        color: ["#ef4444", "#f59e0b", "#22c55e"],
      },
    ],
  };

  const barOption = {
    tooltip: { trigger: "axis" },
    grid: { left: 10, right: 10, top: 20, bottom: 40, containLabel: true },
    xAxis: { type: "value" },
    yAxis: {
      type: "category",
      data: topBars.map((x) => x.name),
      axisLabel: { width: 120, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        data: topBars.map((x) => x.qty),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: "#60a5fa" },
            { offset: 1, color: "#22c55e" },
          ]),
        },
        barWidth: 16,
      },
    ],
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Category Treemap
        </h3>
        <ReactECharts option={treemapOption} style={{ height: 280 }} />
      </div>

      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Stock Health
        </h3>
        <ReactECharts option={donutOption} style={{ height: 280 }} />
      </div>

      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Top Categories
        </h3>
        <ReactECharts option={barOption} style={{ height: 280 }} />
      </div>

      {lowList.length > 0 && (
        <div className="lg:col-span-3 bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Low / Out Categories
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {lowList.map((x) => (
              <div
                key={x.name}
                className="rounded-lg border px-3 py-2 flex items-center justify-between"
              >
                <div className="text-sm font-medium text-gray-700 truncate">
                  {x.name}
                </div>
                <div className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {x.qty}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
