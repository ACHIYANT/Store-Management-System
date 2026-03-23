import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { toStoreApiUrl } from "@/lib/api-config";

const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;
const ALL_ASSETS_ROW_ID = "all-assets";

export default function AssetCategories() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const navigate = useNavigate();

  const fetchCategoriesPage = useCallback(
    async ({ cursor, limit }) => {
      const res = await axios.get(toStoreApiUrl("/assets-by-category"), {
        params: {
          search: debouncedSearch || undefined,
          limit,
          cursorMode: true,
          cursor: cursor || undefined,
        },
      });
      return {
        rows: res?.data?.data || [],
        meta: res?.data?.meta || {},
      };
    },
    [debouncedSearch],
  );

  const {
    rows: categoryRows,
    loading,
    isFetchingMore,
    hasMore,
    loadMore,
    virtualStartIndex,
  } = useCursorWindowedList({
    fetchPage: fetchCategoriesPage,
    deps: [debouncedSearch],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const totalAssets = useMemo(
    () =>
      (categoryRows || []).reduce(
        (sum, row) => sum + Number(row?.total_assets || 0),
        0,
      ),
    [categoryRows],
  );

  const tableData = useMemo(
    () => [
      {
        item_category_id: ALL_ASSETS_ROW_ID,
        category_name: "All Assets",
        total_assets: totalAssets,
        row_kind: "all",
        scope_label: "All Assets",
      },
      ...(categoryRows || []).map((row) => ({
        ...row,
        row_kind: "category",
        scope_label: "Category",
      })),
    ],
    [categoryRows, totalAssets],
  );

  const rowById = useMemo(
    () => new Map(tableData.map((row) => [String(row.item_category_id), row])),
    [tableData],
  );

  const columns = [
    { key: "category_name", label: "Category" },
    { key: "total_assets", label: "Total Assets" },
    {
      key: "scope_label",
      label: "Scope",
      chip: true,
      chipMap: {
        "All Assets": { color: "blue", emoji: "📦" },
        Category: { color: "green", emoji: "🗂️" },
      },
    },
  ];

  const handleRowOpen = (rowId) => {
    const row = rowById.get(String(rowId));
    if (!row) return;

    const targetId =
      row.row_kind === "all" ? "all" : String(row.item_category_id);

    navigate(`/assets-by-category/${targetId}`, {
      state: {
        categoryId: row.item_category_id,
        categoryName: row.category_name,
        totalAssets: Number(row.total_assets || 0),
        rowKind: row.row_kind,
      },
    });
  };

  return (
    <ListPage
      title="📦 Asset Categories"
      columns={columns}
      data={tableData}
      loading={loading}
      idCol="item_category_id"
      onRowClick={handleRowOpen}
      searchPlaceholder="Search category..."
      searchValue={search}
      onSearch={setSearch}
      showAdd={false}
      showUpdate={false}
      showFilter={false}
      table={
        <ListTable
          columns={columns}
          data={tableData}
          idCol="item_category_id"
          onRowClick={handleRowOpen}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={isFetchingMore}
          virtualStartIndex={virtualStartIndex}
        />
      }
    />
  );
}
