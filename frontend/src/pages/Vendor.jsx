import React, { useCallback, useMemo, useState } from "react";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import useDebounce from "@/hooks/useDebounce";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";
import { toStoreApiUrl } from "@/lib/api-config";
import { hasRole } from "@/lib/roles";

const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

export default function Vendor() {
  const [selectedRows, setSelectedRows] = useState(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const canManageMaster = useMemo(() => hasRole("SUPER_ADMIN"), []);

  const fetchVendorsPage = useCallback(
    async ({ cursor, limit }) => {
      const response = await axios.get(toStoreApiUrl("/vendor"), {
        params: {
          search: debouncedSearch || undefined,
          limit,
          cursorMode: true,
          cursor: cursor || undefined,
        },
      });
      return {
        rows: response?.data?.data || [],
        meta: response?.data?.meta || {},
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
    fetchPage: fetchVendorsPage,
    deps: [debouncedSearch],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const columns = [
    { key: "id", label: "ID" },
    { key: "name", label: "Name" },
    { key: "address", label: "Address" },
    {
      key: "gst_no",
      label: "GST Number",
      render: (val) => (
        <span className="text-blue-600">{val ? val : "N/A (Unregistered)"}</span>
      ),
    },
    { key: "mobile_no", label: "Mobile Number" },
  ];



  const navigate = useNavigate();
  function handleAdd() {
    navigate("/vendors-entry");
  }
  function handleUpdate() {
    const selectedVendor = data.find((vendor) => vendor.id === selectedRows);

    console.log("Selected vendor 0", selectedVendor);
    // If a valid employee is selected, navigate to the update page with that employee's data
    if (selectedVendor) {
      navigate("/vendor-update", { state: { selectedVendor } });
    } else {
      alert("Please select a valid vendor");
    }
  }
  const handleRowSelect = (id) => {
    setSelectedRows((prev) => (prev === id ? null : id));
  };

  return (
    <ListPage
      title="Vendor"
      columns={columns}
      data={data}
      loading={loading}
      onAdd={handleAdd}
      idCol="id"
      onUpdate={handleUpdate} // Pass handleUpdate to the ListPage
      showAdd={canManageMaster}
      showUpdate={canManageMaster}
      onFilter={() => console.log("Filter")}
      onSearch={setSearch}
      searchValue={search}
      selectedRows={selectedRows} // Pass selectedRows to ListPage
      setSelectedRows={setSelectedRows}
      table={
        <ListTable
          columns={columns}
          data={data}
          idCol="id"
          selectedRows={selectedRows}
          onRowSelect={handleRowSelect}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={isFetchingMore}
          virtualStartIndex={virtualStartIndex}
        />
      }
    />
  );
}
