import React, { useCallback, useMemo, useState } from "react";
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

export default function EmployeeIssues() {
  const [selectedRows, setSelectedRows] = useState(null);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [filters, setFilters] = useState({ division: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const fetchEmployeesPage = useCallback(
    async ({ cursor, limit }) => {
      const response = await axios.get(toStoreApiUrl("/employee"), {
        params: {
          search: debouncedSearch || undefined,
          division: filters.division || undefined,
          limit,
          cursorMode: true,
          cursor: cursor || undefined,
        },
      });
      const raw = response?.data?.data || [];
      const normalized = raw.map((r) => ({
        employee_id: r.emp_id,
        name: r.name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
        division: r.division ?? r.department ?? r.unit ?? "-",
        designation: r.designation ?? r.title ?? "-",
        ...r,
      }));
      return {
        rows: normalized,
        meta: response?.data?.meta || {},
      };
    },
    [debouncedSearch, filters.division],
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
    deps: [debouncedSearch, filters.division],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const columns = [
    { key: "employee_id", label: "Employee ID" },
    { key: "name", label: "Name" },
    { key: "division", label: "Division" },
    { key: "designation", label: "Designation" },
  ];

  function handleRowClick(employeeId) {
    console.log("emp_id: ", employeeId);
    // navigate to the issued-items page for the given employeeId (client-side navigation)
    if (!employeeId) {
      console.error("Missing employee id for row click");
      return;
    }
    navigate(`/reports/employee-issues/${employeeId}`);
  }

  const divisions = useMemo(() => {
    const set = new Set();
    data.forEach((r) => {
      if (r.division) set.add(r.division);
    });
    return Array.from(set).sort();
  }, [data]);

  const closeFilterPanel = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowFilters(false);
      setIsClosing(false);
    }, 160);
  };

  return (
    <ListPage
      title="Issued to Employees"
      columns={columns}
      data={data}
      loading={loading}
      showAdd={false}
      showUpdate={false}
      showFilter={true}
      searchPlaceholder="Search name or division..."
      searchValue={search}
      onSearch={setSearch}
      onFilter={() =>
        showFilters ? closeFilterPanel() : setShowFilters(true)
      }
      actions={[
        {
          label: "Print Statement",
          onClick: () => {
            if (!selectedRows) {
              alert("Select an employee first.");
              return;
            }
            navigate(`/reports/employee-issues/${selectedRows}/statement`);
          },
        },
      ]}
      idCol="employee_id"
      selectedRows={selectedRows}
      setSelectedRows={setSelectedRows}
      onRowClick={handleRowClick}
      table={
        <ListTable
          columns={columns}
          data={data}
          idCol="employee_id"
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
      aboveContent={
        showFilters && (
          <FilterPanel
            title="Employee Filters"
            fields={[
              {
                key: "division",
                label: "Division",
                type: "select",
                options: divisions.map((d) => ({ value: d, label: d })),
              },
            ]}
            filters={filters}
            onChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
            onReset={() => {
              setFilters({ division: "" });
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
