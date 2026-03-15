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
const CUSTODIAN_TYPES = ["EMPLOYEE", "DIVISION", "VEHICLE"];

export default function EmployeeIssues() {
  const [selectedRows, setSelectedRows] = useState(null);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [filters, setFilters] = useState({ custodianType: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const fetchEmployeesPage = useCallback(
    async ({ cursor, limit, append }) => {
      const page = Number.parseInt(String(cursor || "1"), 10) || 1;
      if (append && page <= 1) {
        return { rows: [], meta: { hasMore: false, nextCursor: null } };
      }

      const response = await axios.get(toStoreApiUrl("/custodians"), {
        params: {
          search: debouncedSearch || undefined,
          custodian_type: filters.custodianType || undefined,
          limit,
          page,
        },
      });
      const raw = response?.data?.data || [];
      const normalized = raw.map((r) => ({
        id: String(r.id || ""),
        custodian_type: String(r.custodian_type || "").toUpperCase(),
        name: r.display_name ?? "-",
        employee_id: r.employee_id ?? "-",
        ...r,
      }));
      const totalPages = Number(response?.data?.meta?.totalPages || 1);
      const hasMore = page < totalPages;
      return {
        rows: normalized,
        meta: {
          hasMore,
          nextCursor: hasMore ? String(page + 1) : null,
        },
      };
    },
    [debouncedSearch, filters.custodianType],
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
    deps: [debouncedSearch, filters.custodianType],
    pageSize: PAGE_SIZE,
    maxBufferRows: MAX_BUFFER_ROWS,
    trimBatch: TRIM_BATCH,
  });

  const columns = [
    { key: "id", label: "Custodian ID" },
    { key: "name", label: "Name" },
    { key: "custodian_type", label: "Type" },
    { key: "employee_id", label: "Employee ID" },
  ];

  function navigateToIssuedReports(custodianId) {
    const selected = data.find((row) => String(row.id) === String(custodianId));
    if (!selected?.id) {
      console.error("Missing custodian id for row click");
      return;
    }
    const type = String(selected.custodian_type || "EMPLOYEE").toUpperCase();
    navigate(
      `/reports/custodian-issues/${encodeURIComponent(selected.id)}?custodianType=${encodeURIComponent(type)}`,
    );
  }

  const custodianTypes = useMemo(() => {
    const set = new Set();
    data.forEach((r) => {
      if (r.custodian_type) set.add(r.custodian_type);
    });
    return Array.from(set).filter((t) => CUSTODIAN_TYPES.includes(t)).sort();
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
      title="Issued to Custodians"
      columns={columns}
      data={data}
      loading={loading}
      showAdd={false}
      showUpdate={false}
      showFilter={true}
      searchPlaceholder="Search custodian name or id..."
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
              alert("Select a custodian first.");
              return;
            }
            const selected = data.find(
              (row) => String(row.id) === String(selectedRows),
            );
            if (!selected?.id) {
              alert("Invalid selection.");
              return;
            }
            const type = String(selected.custodian_type || "EMPLOYEE").toUpperCase();
            navigate(
              `/reports/custodian-issues/${encodeURIComponent(selected.id)}/statement?custodianType=${encodeURIComponent(type)}`,
            );
          },
        },
      ]}
      idCol="id"
      selectedRows={selectedRows}
      setSelectedRows={setSelectedRows}
      onRowClick={navigateToIssuedReports}
      table={
        <ListTable
          columns={columns}
          data={data}
          idCol="id"
          selectedRows={selectedRows}
          onRowSelect={(id) =>
            setSelectedRows((prev) => (prev === id ? null : id))
          }
          onRowClick={navigateToIssuedReports}
          onLoadMore={loadMore}
          hasMore={hasMore}
          loading={isFetchingMore}
          virtualStartIndex={virtualStartIndex}
        />
      }
      aboveContent={
        showFilters && (
          <FilterPanel
            title="Custodian Filters"
            fields={[
              {
                key: "custodianType",
                label: "Type",
                type: "select",
                options: custodianTypes.map((type) => ({
                  value: type,
                  label: type,
                })),
              },
            ]}
            filters={filters}
            onChange={(k, v) => setFilters((prev) => ({ ...prev, [k]: v }))}
            onReset={() => {
              setFilters({ custodianType: "" });
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
