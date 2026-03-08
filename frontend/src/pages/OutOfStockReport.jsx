import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import logo from "/logo.svg";

const API = "http://localhost:3000/api/v1";
const PAGE_LIMIT = 200;
const PARALLEL_BATCH = 8;

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeLabel(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function getItemStatus(quantity) {
  const qty = asNumber(quantity, 0);
  if (qty === 0) return "Out of Stock";
  if (qty <= 5) return "Low Stock";
  return "Available";
}

function isOutOfStock(status) {
  return String(status || "").toLowerCase() === "out of stock";
}

function isLowStock(status) {
  return String(status || "").toLowerCase() === "low stock";
}

async function fetchAllCursor(endpoint, params = {}) {
  const rows = [];
  let cursor = null;
  let keepGoing = true;

  while (keepGoing) {
    const res = await axios.get(endpoint, {
      params: {
        ...params,
        cursorMode: true,
        limit: PAGE_LIMIT,
        cursor: cursor || undefined,
      },
    });

    const chunk = Array.isArray(res?.data?.data) ? res.data.data : [];
    rows.push(...chunk);

    const meta = res?.data?.meta || null;
    if (!meta?.hasMore || !meta?.nextCursor) {
      keepGoing = false;
    } else {
      cursor = meta.nextCursor;
    }
  }

  return rows;
}

function withCategoryCounts(category) {
  const items = Array.isArray(category.items) ? category.items : [];
  const out_item_count = items.filter((it) => isOutOfStock(it.status)).length;
  return {
    ...category,
    items,
    item_count: items.length,
    out_item_count,
  };
}

function withGroupCounts(group) {
  const categories = (group.categories || []).map(withCategoryCounts);
  return {
    ...group,
    categories,
    category_count: categories.length,
    item_count: categories.reduce((sum, c) => sum + c.item_count, 0),
    out_item_count: categories.reduce((sum, c) => sum + c.out_item_count, 0),
  };
}

function withHeadCounts(head) {
  const groups = (head.groups || []).map(withGroupCounts);
  return {
    ...head,
    groups,
    group_count: groups.length,
    category_count: groups.reduce((sum, g) => sum + g.category_count, 0),
    item_count: groups.reduce((sum, g) => sum + g.item_count, 0),
    out_item_count: groups.reduce((sum, g) => sum + g.out_item_count, 0),
  };
}

function buildFullHierarchy(heads, groupsByHeadId, categoriesByGroupId, itemsByCategoryId) {
  const hierarchy = (heads || [])
    .map((head) => {
      const groups = (groupsByHeadId.get(head.id) || []).map((group) => {
        const categories = (categoriesByGroupId.get(group.id) || []).map(
          (category) => ({
            category_id: category.id,
            category_name: normalizeLabel(
              category.category_name,
              `Category #${category.id}`,
            ),
            items: (itemsByCategoryId.get(category.id) || []).slice(),
          }),
        );

        categories.sort((a, b) => a.category_name.localeCompare(b.category_name));

        return {
          group_id: group.id,
          group_name: normalizeLabel(
            group.category_group_name,
            `Group #${group.id}`,
          ),
          categories,
        };
      });

      groups.sort((a, b) => a.group_name.localeCompare(b.group_name));

      return {
        head_id: head.id,
        head_name: normalizeLabel(head.category_head_name, `Head #${head.id}`),
        groups,
      };
    })
    .sort((a, b) => a.head_name.localeCompare(b.head_name));

  return hierarchy.map(withHeadCounts);
}

function toOutOfStockOnlyHierarchy(fullHierarchy) {
  const filtered = (fullHierarchy || [])
    .map((head) => ({
      ...head,
      groups: (head.groups || [])
        .map((group) => ({
          ...group,
          categories: (group.categories || [])
            .map((category) => ({
              ...category,
              items: (category.items || []).filter((it) =>
                isOutOfStock(it.status),
              ),
            }))
            .filter((category) => category.items.length > 0),
        }))
        .filter((group) => group.categories.length > 0),
    }))
    .filter((head) => head.groups.length > 0);

  return filtered.map(withHeadCounts);
}

function applyStatusFilterKeepingHierarchy(fullHierarchy, statusFilter) {
  if (statusFilter === "all") return (fullHierarchy || []).map(withHeadCounts);

  const matchItem =
    statusFilter === "low"
      ? (item) => isLowStock(item.status)
      : (item) => isOutOfStock(item.status);

  const mapped = (fullHierarchy || []).map((head) => ({
    ...head,
    groups: (head.groups || []).map((group) => ({
      ...group,
      categories: (group.categories || []).map((category) => ({
        ...category,
        items: (category.items || []).filter(matchItem),
      })),
    })),
  }));

  return mapped.map(withHeadCounts);
}

function filterHierarchy(hierarchy, searchTerm) {
  const q = String(searchTerm || "").trim().toLowerCase();
  if (!q) return hierarchy;

  return hierarchy
    .map((head) => {
      const headMatch = head.head_name.toLowerCase().includes(q);
      const groups = head.groups
        .map((group) => {
          const groupMatch =
            headMatch || group.group_name.toLowerCase().includes(q);

          if (groupMatch) return group;

          const categories = group.categories
            .map((category) => {
              const categoryMatch =
                category.category_name.toLowerCase().includes(q) || groupMatch;

              if (categoryMatch) return category;

              const items = (category.items || []).filter((item) => {
                const itemName = String(item.item_name || "").toLowerCase();
                const itemCode = String(item.id || "").toLowerCase();
                const itemType = String(item.type_label || "").toLowerCase();
                const itemStatus = String(item.status || "").toLowerCase();
                return (
                  itemName.includes(q) ||
                  itemCode.includes(q) ||
                  itemType.includes(q) ||
                  itemStatus.includes(q)
                );
              });

              if (items.length === 0) return null;
              return { ...category, items };
            })
            .filter(Boolean);

          if (categories.length === 0) return null;

          return withGroupCounts({ ...group, categories });
        })
        .filter(Boolean);

      if (headMatch) return head;
      if (groups.length === 0) return null;

      return withHeadCounts({ ...head, groups });
    })
    .filter(Boolean);
}

function StatusChip({ status }) {
  const s = String(status || "");
  if (s === "Out of Stock") {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
        Out of Stock
      </span>
    );
  }
  if (s === "Low Stock") {
    return (
      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
        Low Stock
      </span>
    );
  }
  return (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
      Available
    </span>
  );
}

export default function OutOfStockReport() {
  const [mode, setMode] = useState("full"); // full | out-only
  const [fullModeFilter, setFullModeFilter] = useState("all"); // all | low | out
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [hierarchy, setHierarchy] = useState([]);
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
      const headsRes = await axios.get(`${API}/category-head`);
      const heads = Array.isArray(headsRes?.data?.data) ? headsRes.data.data : [];

      const groupsByHeadId = new Map();
      for (let i = 0; i < heads.length; i += PARALLEL_BATCH) {
        const batch = heads.slice(i, i + PARALLEL_BATCH);
        await Promise.all(
          batch.map(async (head) => {
            try {
              const res = await axios.get(
                `${API}/category-group/by-head/${head.id}`,
              );
              groupsByHeadId.set(
                head.id,
                Array.isArray(res?.data?.data) ? res.data.data : [],
              );
            } catch (_err) {
              groupsByHeadId.set(head.id, []);
            }
          }),
        );
      }

      const allGroups = [];
      for (const head of heads) {
        const groups = groupsByHeadId.get(head.id) || [];
        for (const group of groups) {
          allGroups.push({ ...group, __head_id: head.id });
        }
      }

      const categoriesByGroupId = new Map();
      for (let i = 0; i < allGroups.length; i += PARALLEL_BATCH) {
        const batch = allGroups.slice(i, i + PARALLEL_BATCH);
        await Promise.all(
          batch.map(async (group) => {
            try {
              const categories = await fetchAllCursor(`${API}/itemCategory/search`, {
                head_id: group.__head_id,
                group_id: group.id,
              });
              categoriesByGroupId.set(group.id, categories || []);
            } catch (_err) {
              categoriesByGroupId.set(group.id, []);
            }
          }),
        );
      }

      const allCategories = [];
      for (const group of allGroups) {
        const categories = categoriesByGroupId.get(group.id) || [];
        for (const category of categories) allCategories.push(category);
      }

      const itemsByCategoryId = new Map();
      for (let i = 0; i < allCategories.length; i += PARALLEL_BATCH) {
        const batch = allCategories.slice(i, i + PARALLEL_BATCH);
        await Promise.all(
          batch.map(async (category) => {
            try {
              const rows = await fetchAllCursor(
                `${API}/stock-items-all/${category.id}`,
              );
              const items = (rows || [])
                .map((item) => {
                  const quantity = asNumber(item.quantity, 0);
                  const serializedRequired = Boolean(
                    item.serialized_required ??
                      item["ItemCategory.serialized_required"],
                  );

                  return {
                    id: item.id,
                    item_name: normalizeLabel(item.item_name, `Item #${item.id}`),
                    quantity,
                    status: getItemStatus(quantity),
                    type_label: serializedRequired ? "Asset" : "Consumable",
                  };
                })
                .sort((a, b) => a.item_name.localeCompare(b.item_name));

              itemsByCategoryId.set(category.id, items);
            } catch (_err) {
              itemsByCategoryId.set(category.id, []);
            }
          }),
        );
      }

      const fullHierarchy = buildFullHierarchy(
        heads,
        groupsByHeadId,
        categoriesByGroupId,
        itemsByCategoryId,
      );

      setHierarchy(fullHierarchy);
      setGeneratedAt(new Date().toLocaleString());
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load stock report.",
      );
      setHierarchy([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const hierarchyByMode = useMemo(() => {
    if (mode === "out-only") return toOutOfStockOnlyHierarchy(hierarchy);
    return applyStatusFilterKeepingHierarchy(hierarchy, fullModeFilter);
  }, [hierarchy, mode, fullModeFilter]);

  const filteredHierarchy = useMemo(
    () => filterHierarchy(hierarchyByMode, search),
    [hierarchyByMode, search],
  );

  const emptyMessage =
    mode === "out-only"
      ? "No out-of-stock items found."
      : fullModeFilter === "low"
        ? "No low-stock items found."
        : fullModeFilter === "out"
          ? "No out-of-stock items found."
          : "No data available for this report.";

  const reportTitle =
    mode === "out-only"
      ? "Out of Stock Only Report"
      : fullModeFilter === "low"
        ? "Full Report - Low Stock"
        : fullModeFilter === "out"
          ? "Full Report - Out of Stock"
          : "Full Report - All Items";

  const summary = useMemo(() => {
    let groups = 0;
    let categories = 0;
    let items = 0;
    let out = 0;
    let low = 0;
    let available = 0;

    filteredHierarchy.forEach((head) => {
      groups += head.groups.length;
      head.groups.forEach((group) => {
        categories += group.categories.length;
        group.categories.forEach((category) => {
          items += category.items.length;
          category.items.forEach((item) => {
            if (isOutOfStock(item.status)) out += 1;
            else if (isLowStock(item.status)) low += 1;
            else available += 1;
          });
        });
      });
    });

    return {
      heads: filteredHierarchy.length,
      groups,
      categories,
      items,
      out,
      low,
      available,
    };
  }, [filteredHierarchy]);

  const handlePrint = () => {
    const now = new Date();
    setPrintTimestamp(now.toLocaleString());
    setTimeout(() => {
      window.print();
    }, 50);
  };

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

        <h2 className="mb-2 text-center text-xl font-semibold">{reportTitle}</h2>

        <div className="no-print print:hidden mb-4 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setMode("full")}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              mode === "full"
                ? "border-blue-600 bg-blue-600 text-white"
                : "bg-white text-gray-700"
            }`}
          >
            Full Report
          </button>
          <button
            onClick={() => setMode("out-only")}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              mode === "out-only"
                ? "border-blue-600 bg-blue-600 text-white"
                : "bg-white text-gray-700"
            }`}
          >
            Only Out of Stock
          </button>
        </div>

        {mode === "full" && (
          <div className="no-print print:hidden mb-4 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setFullModeFilter("all")}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                fullModeFilter === "all"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "bg-white text-gray-700"
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setFullModeFilter("low")}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                fullModeFilter === "low"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "bg-white text-gray-700"
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setFullModeFilter("out")}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                fullModeFilter === "out"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "bg-white text-gray-700"
              }`}
            >
              Out of Stock
            </button>
          </div>
        )}

        <div className="no-print print:hidden mb-4 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by head, group, category, item or status..."
            className="no-print min-w-[260px] flex-1 rounded border px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            className="rounded bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && <div className="mb-4 text-sm">Loading report...</div>}

        {!loading && (
          <div className="mb-4 grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
            <div className="rounded border p-3">
              <div className="space-y-1">
                <div>
                  <strong>Report Type:</strong> {reportTitle}
                </div>
                <div>
                  <strong>Generated On:</strong> {generatedAt || "-"}
                </div>
                <div>
                  <strong>Search:</strong> {search?.trim() ? search : "None"}
                </div>
              </div>
            </div>
            <div className="rounded border p-3">
              <div className="space-y-1">
                <div>
                  <strong>Total Heads:</strong> {summary.heads}
                </div>
                <div>
                  <strong>Total Groups:</strong> {summary.groups}
                </div>
                <div>
                  <strong>Total Categories:</strong> {summary.categories}
                </div>
              </div>
            </div>
            <div className="rounded border p-3">
              <div className="space-y-1">
                <div>
                  <strong>Total Items:</strong> {summary.items}
                </div>
                <div>
                  <strong>Out of Stock:</strong> {summary.out}
                </div>
                <div>
                  <strong>Low Stock:</strong> {summary.low}
                </div>
                <div>
                  <strong>Available:</strong> {summary.available}
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && filteredHierarchy.length === 0 && (
          <div className="mb-4 rounded border p-3 text-sm">{emptyMessage}</div>
        )}

        {!loading &&
          filteredHierarchy.map((head) => (
            <div key={head.head_id} className="mb-4 rounded border">
              <div className="border-b bg-gray-200 px-3 py-2 text-sm font-semibold">
                Category Head: {head.head_name}
              </div>

              {head.groups.length === 0 ? (
                <div className="p-3 text-sm">No groups under this category head.</div>
              ) : (
                <div className="space-y-3 p-3">
                  {head.groups.map((group) => (
                    <div key={`${head.head_id}-${group.group_id}`} className="rounded border">
                      <div className="border-b bg-gray-100 px-3 py-2 text-sm font-semibold">
                        Category Group: {group.group_name}
                      </div>

                      {group.categories.length === 0 ? (
                        <div className="p-3 text-sm">No categories under this group.</div>
                      ) : (
                        <div className="space-y-3 p-3">
                          {group.categories.map((category) => (
                            <div key={category.category_id} className="rounded border">
                              <div className="border-b bg-gray-50 px-3 py-2 text-sm font-semibold">
                                Category: {category.category_name}
                              </div>

                              {category.items.length === 0 ? (
                                <div className="p-3 text-sm">No items in this category.</div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full border border-collapse text-sm">
                                    <thead>
                                      <tr className="bg-gray-200">
                                        <th className="border p-1">#</th>
                                        <th className="border p-1">Item Name</th>
                                        <th className="border p-1">Type</th>
                                        <th className="border p-1">Qty</th>
                                        <th className="border p-1">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {category.items.map((item, idx) => (
                                        <tr
                                          key={`${category.category_id}-${item.id}-${idx}`}
                                        >
                                          <td className="border p-1">{idx + 1}</td>
                                          <td className="border p-1">{item.item_name || "-"}</td>
                                          <td className="border p-1">{item.type_label}</td>
                                          <td className="border p-1">{item.quantity}</td>
                                          <td className="border p-1">
                                            <StatusChip status={item.status} />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
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
          Print Report
        </button>
      </div>
    </div>
  );
}
