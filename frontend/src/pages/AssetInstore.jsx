import React, { useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import axios from "axios";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { toStoreApiUrl } from "@/lib/api-config";

const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

const safeText = (v) => (v ? v : "-");

export default function AssetInStore() {
  const { stockId } = useParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const fetchAssetsPage = useCallback(
    async ({ cursor, limit }) => {
      const res = await axios.get(
        toStoreApiUrl(`/assets/instore/${stockId}`),
        {
          params: {
            search: debouncedSearch || undefined,
            limit,
            cursorMode: true,
            cursor: cursor || undefined,
          },
        },
      );
      return {
        rows: res?.data?.data || [],
        meta: res?.data?.meta || {},
      };
    },
    [debouncedSearch, stockId],
  );

  const {
    rows: data,
    loading,
    isFetchingMore,
    hasMore,
    loadMore,
    virtualStartIndex,
  } = useCursorWindowedList({
    fetchPage: fetchAssetsPage,
    deps: [stockId, debouncedSearch],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const columns = [
    { key: "asset_tag", label: "Asset Tag", render: safeText },
    { key: "serial_number", label: "Serial No", render: safeText },
    { key: "status", label: "Status", render: safeText },
    { key: "purchased_at", label: "Purchased On", render: safeText },
    { key: "warranty_expiry", label: "Warranty Till", render: safeText },
    {
      key: "current_employee_id",
      label: "Issued To",
      render: (v) => (v ? `Emp #${v}` : "In Store"),
    },
  ];

  return (
    <>
      <button
        className="mb-4 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>

      <ListPage
        title="🖥️ Assets In Store"
        columns={columns}
        data={data}
        loading={loading}
        idCol="id"
        searchPlaceholder="Search asset tag / serial..."
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
        showAdd={false}
        showUpdate={false}
        showFilter={false}
      />
    </>
  );
}
