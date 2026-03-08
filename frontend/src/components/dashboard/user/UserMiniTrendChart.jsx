import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export default function UserMiniTrendChart({ trend = [] }) {
  const { labels, values } = useMemo(() => {
    const rows = Array.isArray(trend) ? trend : [];
    return {
      labels: rows.map((row) => row.label || row.month_key || "-"),
      values: rows.map((row) => toNumber(row.total)),
    };
  }, [trend]);

  if (!labels.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        No monthly trend data available.
      </div>
    );
  }

  const option = {
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 8, top: 18, bottom: 24, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { fontSize: 11, color: "#475569" },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
    },
    yAxis: {
      type: "value",
      minInterval: 1,
      axisLabel: { fontSize: 11, color: "#64748b" },
      splitLine: { lineStyle: { color: "#e2e8f0" } },
    },
    series: [
      {
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        data: values,
        lineStyle: { width: 3, color: "#0f766e" },
        itemStyle: { color: "#0f766e" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(15,118,110,0.35)" },
            { offset: 1, color: "rgba(15,118,110,0.03)" },
          ]),
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 220 }} />;
}
