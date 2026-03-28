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

export default function Employee() {
  const [selectedRows, setSelectedRows] = useState(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const canManageMaster = useMemo(() => hasRole("SUPER_ADMIN"), []);

  const fetchEmployeesPage = useCallback(
    async ({ cursor, limit }) => {
      const response = await axios.get(toStoreApiUrl("/employee"), {
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
    fetchPage: fetchEmployeesPage,
    deps: [debouncedSearch],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const columns = [
    { key: "emp_id", label: "Employee Id" },
    { key: "name", label: "Name" },
    { key: "father_name", label: "Father's Name" },
    { key: "email_id", label: "Email Address" },
    {
      key: "designation",
      label: "Designation",
      //   render: (val) => <span className="text-blue-600">{val}</span>,
    },
    { key: "division", label: "Division" },
    { key: "group_head", label: "Reporting Officer" },
    { key: "gender", label: "Gender" },
    { key: "office_location", label: "Office Location" },
    { key: "mobile_no", label: "Contact Number" },
  ];


  const navigate = useNavigate();
  function handleAdd() {
    navigate("/employees-entry");
  }

  function handleUpdate() {
    const selectedEmployee = data.find(
      (employee) => employee.emp_id === selectedRows
    );

    console.log("Selected employee 0", selectedEmployee);
    // If a valid employee is selected, navigate to the update page with that employee's data
    if (selectedEmployee) {
      navigate("/employee-update", { state: { selectedEmployee } });
    } else {
      alert("Please select a valid employee");
    }
  }
  const handleRowSelect = (id) => {
    setSelectedRows((prev) => (prev === id ? null : id));
  };

  return (
    <ListPage
      title="Employees"
      columns={columns}
      data={data}
      loading={loading}
      onAdd={handleAdd}
      idCol="emp_id"
      onUpdate={handleUpdate} // Pass handleUpdate to the ListPage
      showAdd={canManageMaster}
      showUpdate={canManageMaster}
      onFilter={() => console.log("Filter")}
      onSearch={setSearch}
      searchValue={search}
      selectedRows={selectedRows} // Pass selectedRows to ListPage
      setSelectedRows={setSelectedRows} // Allow ListPage to update selectedRows
      table={
        <ListTable
          columns={columns}
          data={data}
          idCol="emp_id"
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
