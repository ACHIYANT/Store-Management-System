import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import FilterPanel from "@/components/FilterPanel";
import axios from "axios";
import useDebounce from "@/hooks/useDebounce";
import { Divide } from "lucide-react";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { DEFAULT_SKU_UNIT } from "@/constants/skuUnits";

const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

function SerialBadge({ serialized_required }) {
  if (serialized_required) {
    return (
      <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded">
        Asset
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
      Consumable
    </span>
  );
}

/* 🔴🟡🟢 Quantity Badge */
function QtyBadge({ qty }) {
  const value = Number(qty);

  if (value === 0)
    return (
      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">
        Out
      </span>
    );

  if (value <= 5)
    return (
      <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
        Low
      </span>
    );

  return (
    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
      OK
    </span>
  );
}

function ItemTypeBadge({ serializedRequired, stockId, navigate }) {
  if (serializedRequired) {
    return (
      <span
        onClick={() => navigate(`/assets/instore/${stockId}`)}
        className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded cursor-pointer hover:bg-indigo-200 hover:underline"
      >
        Asset
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
      Consumable
    </span>
  );
}

export default function StockItems() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const [filters, setFilters] = useState({
    type: "",
    stockLevel: "",
    source: "",
  });

  const [showFilters, setShowFilters] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const fetchStockItemsPage = useCallback(
    async ({ cursor, limit }) => {
      const res = await axios.get(
        `http://localhost:3000/api/v1/stock-items-all/${id}`,
        {
          params: {
            search: debouncedSearch || undefined,
            stockLevel: filters.stockLevel || undefined,
            source: filters.source || undefined,
            limit,
            cursorMode: true,
            cursor: cursor || undefined,
          },
        },
      );

      const mapped = (res?.data?.data || []).map((row) => {
        const isSerialized = Boolean(row["ItemCategory.serialized_required"]);
        const qty = Number(row.quantity || 0);
        const rawSource = String(
          row.source || row.source_profile || "",
        ).toUpperCase();
        const sourceLabel =
          rawSource === "DAYBOOK"
            ? "DayBook"
            : rawSource === "MIGRATION"
              ? "Migration"
              : rawSource === "MIXED"
                ? "Mixed"
                : row.source_profile && row.source_profile !== "-"
                  ? row.source_profile
                  : "Unclassified";

        return {
          ...row,
          serialized_required: isSerialized,
          sku_unit: row.sku_unit || DEFAULT_SKU_UNIT,
          category_name: row["ItemCategory.category_name"],
          item_type_label: isSerialized ? "Asset" : "Consumable",
          source_label: sourceLabel,
          stock_status:
            qty === 0 ? "Out of Stock" : qty <= 5 ? "Low Stock" : "Available",
        };
      });

      return {
        rows: mapped,
        meta: res?.data?.meta || {},
      };
    },
    [debouncedSearch, filters.stockLevel, filters.source, id],
  );

  const {
    rows: data,
    loading,
    isFetchingMore,
    hasMore,
    loadMore,
    virtualStartIndex,
  } = useCursorWindowedList({
    fetchPage: fetchStockItemsPage,
    deps: [id, debouncedSearch, filters.stockLevel, filters.source],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const columns = [
    { key: "id", label: "ID" },

    {
      key: "item_name",
      label: "Item Name",
      render: (val) => <span className="font-medium">{val}</span>,
    },

    {
      key: "quantity",
      label: "Qty",
      render: (val, row) => (
        <span className="font-semibold">
          {val} {row?.sku_unit || DEFAULT_SKU_UNIT}
        </span>
      ),
    },
    { key: "sku_unit", label: "SKU Unit" },
    {
      key: "stock_status",
      label: "Status",
      chip: true,
      chipMap: {
        "Out of Stock": { color: "red", emoji: "⛔" },
        "Low Stock": { color: "yellow", emoji: "⚠️" },
        Available: { color: "green", emoji: "✅" },
      },
    },
    {
      key: "source_label",
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
      key: "serial_count",
      label: "Serials",
      // render: (val, row) =>
      //   row.serialized_required ? <span>{val} serials</span> : "-",
      render: (val, row) =>
        row.serialized_required ? (
          <button
            className="text-blue-600 cursor-pointer"
            onClick={() => navigate(`/assets/instore/${row.id}`)}
          >
            {val} Serials
          </button>
        ) : (
          "-"
        ),
    },

    {
      key: "item_type_label",
      label: "Type",
      chip: true,
      chipMap: {
        Asset: { color: "indigo", emoji: "💻" },
        Consumable: { color: "gray", emoji: "🧾" },
      },
    },

    { key: "rate", label: "Unit Rate" },
    { key: "gst_rate", label: "GST %" },

    {
      key: "amount",
      label: "Total Value",
      render: (val) => <span className="font-semibold">₹ {val}</span>,
    },
  ];

  const filterFields = [
    {
      key: "type",
      label: "Item Type",
      type: "select",
      options: [
        { value: "SERIALIZED", label: "Asset" },
        { value: "NON_SERIALIZED", label: "Consumable" },
      ],
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
    <>
      <button
        className="mb-4 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
        onClick={() => navigate(-1)}
      >
        ← Back to Stock
      </button>

      <ListPage
        title="📦 Stock Items"
        columns={columns}
        data={data}
        loading={loading}
        idCol="id"
        searchPlaceholder="Search item..."
        searchValue={search}
        onSearch={setSearch}
        table={
          <ListTable
            columns={columns}
            data={data}
            idCol="id"
            onLoadMore={loadMore}
            hasMore={hasMore}
            loading={isFetchingMore}
            virtualStartIndex={virtualStartIndex}
          />
        }
        onFilter={() =>
          showFilters ? closeFilterPanel() : setShowFilters(true)
        }
        showAdd={false}
        showUpdate={false}
        aboveContent={
          showFilters && (
            <FilterPanel
              title="Item Filters"
              fields={filterFields}
              filters={filters}
              onChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
              onReset={() => {
                setFilters({ type: "", stockLevel: "", source: "" });
                closeFilterPanel();
              }}
              onClose={closeFilterPanel}
              isClosing={isClosing}
            />
          )
        }
      />
    </>
  );
}
