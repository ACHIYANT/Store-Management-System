import React, { useCallback, useEffect, useState } from "react";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import FilterPanel from "@/components/FilterPanel";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { toStoreApiUrl } from "@/lib/api-config";

const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

/* 🔴🟡🟢 Stock Status Badge */
function StockBadge({ qty }) {
  const value = Number(qty); // IMPORTANT: ensure number

  if (value === 0) {
    return (
      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
        Out of Stock
      </span>
    );
  }

  if (value > 0 && value <= 5) {
    return (
      <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
        Low Stock
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
      Available
    </span>
  );
}

export default function Stock() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const [showFilters, setShowFilters] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const [filters, setFilters] = useState({
    categoryHeadId: "",
    categoryGroupId: "",
    stockLevel: "",
    source: "",
  });

  const [heads, setHeads] = useState([]);
  const [groups, setGroups] = useState([]);

  const fetchStocksPage = useCallback(
    async ({ cursor, limit }) => {
      const res = await axios.get(toStoreApiUrl("/stocks-by-category"), {
        params: {
          search: debouncedSearch || undefined,
          categoryHeadId: filters.categoryHeadId || undefined,
          categoryGroupId: filters.categoryGroupId || undefined,
          stockLevel: filters.stockLevel || undefined,
          source: filters.source || undefined,
          limit,
          cursorMode: true,
          cursor: cursor || undefined,
        },
      });

      const rows = res?.data?.data || [];
      const withStatus = rows.map((r) => {
        const qty = Number(r.total_quantity || 0);
        const daybookQty = Number(r.daybook_quantity || 0);
        const migrationQty = Number(r.migration_quantity || 0);
        const daybookLots = Number(r.daybook_lot_count || 0);
        const migrationLots = Number(r.migration_lot_count || 0);
        const unknownLots = Number(r.unknown_lot_count || 0);
        const status =
          qty === 0 ? "Out of Stock" : qty <= 5 ? "Low Stock" : "Available";
        const sourceProfile =
          r.source_profile ||
          (daybookLots > 0 && migrationLots > 0
            ? "Mixed"
            : migrationLots > 0
              ? "Migration"
              : daybookLots > 0
                ? "DayBook"
                : unknownLots > 0
                  ? "Unclassified"
                  : daybookQty > 0 && migrationQty > 0
                    ? "Mixed"
                    : migrationQty > 0
                      ? "Migration"
                      : daybookQty > 0
                        ? "DayBook"
                        : "Unclassified");
        return { ...r, stock_status: status, source_profile: sourceProfile };
      });

      return {
        rows: withStatus,
        meta: res?.data?.meta || {},
      };
    },
    [debouncedSearch, filters],
  );

  const {
    rows: data,
    loading,
    isFetchingMore,
    hasMore,
    loadMore,
    virtualStartIndex,
  } = useCursorWindowedList({
    fetchPage: fetchStocksPage,
    deps: [debouncedSearch, filters],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });
  /* 📥 Load Category Heads */
  useEffect(() => {
    axios.get(toStoreApiUrl("/category-head")).then((res) => {
      setHeads(res.data.data || []);
    });
  }, []);

  /* 📥 Load Groups when Head changes */
  useEffect(() => {
    if (!filters.categoryHeadId) {
      setGroups([]);
      return;
    }

    axios
      .get(
        toStoreApiUrl(`/category-group/by-head/${filters.categoryHeadId}`),
      )
      .then((res) => {
        setGroups(res.data.data || []);
      });
  }, [filters.categoryHeadId]);

  const columns = [
    // { key: "item_category_id", label: "Category ID" },
    { key: "category_name", label: "Category" },
    { key: "total_quantity", label: "Total Qty" },
    {
      key: "source_profile",
      label: "Source",
      chip: true,
      chipMap: {
        DayBook: { color: "blue", emoji: "🧾" },
        Migration: { color: "indigo", emoji: "📥" },
        Mixed: { color: "purple", emoji: "🔀" },
        Unclassified: { color: "gray", emoji: "❔" },
      },
    },
    {
      key: "stock_status",
      label: "Status",
      // render: (_, row) => <StockBadge qty={row.total_quantity} />,
      chip: true,
      chipMap: {
        "Out of Stock": { color: "red", emoji: "⛔" },
        "Low Stock": { color: "yellow", emoji: "⚠️" },
        Available: { color: "green", emoji: "✅" },
      },
    },
  ];

  const filterFields = [
    {
      key: "categoryHeadId",
      label: "Category Head",
      type: "select",
      options: heads.map((h) => ({
        value: h.id,
        label: h.category_head_name,
      })),
    },
    {
      key: "categoryGroupId",
      label: "Category Group",
      type: "select",
      options: groups.map((g) => ({
        value: g.id,
        label: g.category_group_name,
      })),
    },
    {
      key: "stockLevel",
      label: "Stock Level",
      type: "select",
      options: [
        { value: "OUT", label: "Out of Stock" },
        { value: "LOW", label: "Low Stock" },
        { value: "AVAILABLE", label: "Available" },
      ],
    },
    {
      key: "source",
      label: "Source",
      type: "select",
      options: [
        { value: "DAYBOOK", label: "DayBook" },
        { value: "MIGRATION", label: "Migration" },
      ],
    },
  ];

  const closeFilterPanel = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowFilters(false);
      setIsClosing(false);
    }, 160);
  };

  return (
    <ListPage
      title="📦 Stock Summary"
      columns={columns}
      data={data}
      loading={loading}
      idCol="item_category_id"
      searchPlaceholder="Search category..."
      searchValue={search}
      onSearch={setSearch}
      onRowClick={(id) => navigate(`/stock-items-all/${id}`)}
      onFilter={() => (showFilters ? closeFilterPanel() : setShowFilters(true))}
      showAdd={false}
      showUpdate={false}
      table={
        <ListTable
          columns={columns}
          data={data}
          idCol="item_category_id"
          onRowClick={(id) => navigate(`/stock-items-all/${id}`)}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={isFetchingMore}
          virtualStartIndex={virtualStartIndex}
        />
      }
      aboveContent={
        showFilters && (
          <FilterPanel
            title="Stock Filters"
            fields={filterFields}
            filters={filters}
            onChange={(k, v) =>
              setFilters((prev) => ({
                ...prev,
                [k]: v,
                ...(k === "categoryHeadId" ? { categoryGroupId: "" } : {}),
              }))
            }
            onReset={() => {
              setFilters({
                categoryHeadId: "",
                categoryGroupId: "",
                stockLevel: "",
                source: "",
              });
              closeFilterPanel();
            }}
            onClose={closeFilterPanel}
            isClosing={isClosing}
          />
        )
      }
    />
  );
}
