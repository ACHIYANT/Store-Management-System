import React, { useState, useEffect, useRef, useCallback } from "react";
import ListPage from "@/components/ListPage";
import ListTable from "@/components/ListTable";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import useDebounce from "@/hooks/useDebounce";
import FilterPanel from "@/components/FilterPanel";
import useCursorWindowedList from "@/hooks/useCursorWindowedList";

const PAGE_SIZE = 100;
const MAX_BUFFER_ROWS = 3000;
const TRIM_BATCH = 1000;

export default function ItemCategory() {
  const [selectedRows, setSelectedRows] = useState(null);
  const [filters, setFilters] = useState({
    category_name: "",
    head_id: "",
    group_id: "",
    serialized_required: "",
  });

  const [categoryHeads, setCategoryHeads] = useState([]);
  const [categoryGroups, setCategoryGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const [showFilters, setShowFilters] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isBackdropClosing, setIsBackdropClosing] = useState(false);
  const filterRef = useRef(null);
  const itemCategoryFilterFields = [
    {
      key: "serialized_required",
      label: "Asset Type",
      type: "select",
      options: [
        { value: "", label: "All" },
        { value: "true", label: "Serialized" },
        { value: "false", label: "Non-Serialized" },
      ],
    },
    {
      key: "head_id",
      label: "Category Head",
      type: "select",
      options: categoryHeads.map((h) => ({
        value: h.id,
        label: h.category_head_name,
      })),
    },
    {
      key: "group_id",
      label: "Category Group",
      type: "select",
      options: categoryGroups.map((g) => ({
        value: g.id,
        label: g.category_group_name,
      })),
    },
  ];
  //clearing group if head changed in filter
  useEffect(() => {
    if (!filters.head_id) {
      setFilters((prev) => ({ ...prev, group_id: "" }));
    }
  }, [filters.head_id]);

  useEffect(() => {
    axios
      .get("http://localhost:3000/api/v1/category-head")
      .then((res) => setCategoryHeads(res.data.data || []));
  }, []);

  useEffect(() => {
    if (!filters.head_id) {
      setCategoryGroups([]);
      return;
    }

    axios
      .get(
        `http://localhost:3000/api/v1/category-group/by-head/${filters.head_id}`,
      )
      .then((res) => setCategoryGroups(res.data.data || []));
  }, [filters.head_id]);


  const fetchItemCategoriesPage = useCallback(
    async ({ cursor, limit }) => {
      const response = await axios.get(
        "http://localhost:3000/api/v1/itemCategory/search",
        {
          params: {
            category_name: debouncedSearchTerm || undefined,
            serialized_required:
              filters.serialized_required !== ""
                ? filters.serialized_required
                : undefined,
            head_id: filters.head_id || undefined,
            group_id: filters.group_id || undefined,
            limit,
            cursorMode: true,
            cursor: cursor || undefined,
          },
        },
      );
      return {
        rows: response?.data?.data || [],
        meta: response?.data?.meta || {},
      };
    },
    [debouncedSearchTerm, filters],
  );

  const {
    rows: data,
    loading,
    isFetchingMore,
    hasMore,
    loadMore,
    virtualStartIndex,
  } = useCursorWindowedList({
    fetchPage: fetchItemCategoriesPage,
    deps: [debouncedSearchTerm, filters],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const columns = [
    // { key: "id", label: "ID" },
    { key: "category_name", label: "Item Category" },
    {
      key: "category_group_name",
      label: "Category Group",
      render: (_, row) => row.group?.category_group_name || "-",
    },

    {
      key: "category_head_name",
      label: "Category Head",
      render: (_, row) => row.group?.head?.category_head_name || "-",
    },
    {
      key: "serialized_required",
      label: "Asset",
      render: (_, row) => (row.serialized_required ? "Yes" : "No"),
    },
    
  ];



  const navigate = useNavigate();
  function handleAdd() {
    navigate("/itemCategory-entry");
  }
  function handleUpdate() {
    const selectedItemCategory = data.find(
      (itemCategory) => itemCategory.id === selectedRows,
    );

    console.log("Selected vendor 0", selectedItemCategory);
    // If a valid employee is selected, navigate to the update page with that employee's data
    if (selectedItemCategory) {
      navigate("/itemCategory-update", { state: { selectedItemCategory } });
    } else {
      alert("Please select a valid item category");
    }
  }
  const closeFilterPanel = () => {
    setIsClosing(true);
    setIsBackdropClosing(true);

    setTimeout(() => {
      setShowFilters(false);
      setIsClosing(false);
      setIsBackdropClosing(false);
    }, 160); // must match CSS animation duration
  };

  return (
    <ListPage
      title="Item Category"
      columns={columns}
      data={data}
      onAdd={handleAdd}
      // apiUrl="http://localhost:3000/api/v1/itemCategory/search"
      loading={loading}
      // searchParam="name"
      idCol="id"
      onFilter={() => setShowFilters((prev) => !prev)}
      onUpdate={handleUpdate} // Pass handleUpdate to the ListPage
      selectedRows={selectedRows} // Pass selectedRows to ListPage
      setSelectedRows={setSelectedRows}
      onSearch={(term) => setSearchTerm(term)}
      searchValue={searchTerm}
      table={
        <ListTable
          columns={columns}
          data={data}
          idCol="id"
          selectedRows={selectedRows}
          onRowSelect={(id) =>
            setSelectedRows((prev) => (prev === id ? null : id))
          }
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={isFetchingMore}
          virtualStartIndex={virtualStartIndex}
        />
      }
      aboveContent={
        showFilters && (
          <>
            <div className={`fixed inset-0 bg-black/10 z-40`} />
            <div ref={filterRef} className="absolute right-0 z-50">
              <FilterPanel
                title="Item Category Filter"
                filters={filters}
                fields={itemCategoryFilterFields}
                onChange={(k, v) => {
                  setFilters((prev) => ({ ...prev, [k]: v }));
                  // closeFilterPanel();
                }}
                onReset={() => {
                  setFilters({
                    category_name: "",
                    serialized_required: "",
                    head_id: "",
                    group_id: "",
                  });
                  setSearchTerm("");
                  closeFilterPanel();
                }}
                onClose={closeFilterPanel}
                isClosing={isClosing}
              />
            </div>
          </>
        )
      }
    />
  );
}
