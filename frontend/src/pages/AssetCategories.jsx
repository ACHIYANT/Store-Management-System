import React, { useCallback, useState } from "react";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";

const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

export default function AssetCategories() {
  const [selectedRows, setSelectedRows] = useState(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const navigate = useNavigate();

  const fetchCategoriesPage = useCallback(
    async ({ cursor, limit }) => {
      const res = await axios.get("http://localhost:3000/api/v1/assets-by-category", {
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
    rows: data,
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

  const columns = [
    { key: "item_category_id", label: "ID" },
    { key: "category_name", label: "Category Name" },
    { key: "total_assets", label: "Total Assets" },
  ];

  function handleRowClick(categoryId) {
    navigate(`/assets-by-category/${categoryId}`);
  }

  return (
    <ListPage
      title="📦 Asset Categories"
      columns={columns}
      data={data}
      loading={loading}
      idCol="item_category_id"
      selectedRows={selectedRows}
      setSelectedRows={setSelectedRows}
      onRowClick={handleRowClick}
      searchPlaceholder="Search category..."
      searchValue={search}
      onSearch={setSearch}
      table={
        <ListTable
          columns={columns}
          data={data}
          idCol="item_category_id"
          selectedRows={selectedRows}
          onRowSelect={(id) =>
            setSelectedRows((prev) => (prev === id ? null : id))
          }
          onRowClick={handleRowClick}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={isFetchingMore}
          virtualStartIndex={virtualStartIndex}
        />
      }
      showAdd={false}
      showUpdate={false}
      showFilter={false}
    />
  );
}
