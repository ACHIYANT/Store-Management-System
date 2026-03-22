import React, { useState, useEffect, useRef } from "react";
import TopBar from "./TopBar";
import ListTable from "./ListTable";
import noData from "/no-data.jpg";
import loaderVideo from "../assets/Paperplane.webm";

const ListPage = ({
  title,
  columns = [],
  data = [],
  onAdd,
  onUpdate,
  onFilter,
  actions,
  idCol = "id",
  onSearch,
  searchValue,
  selectedRows, // optional
  setSelectedRows, // optional
  onRowClick,
  // optional custom slots
  aboveContent, // ReactNode above table
  table, // custom table node; if provided, ListTable is skipped
  belowContent, //ReactNode below table
  loading = false,
  updateDisabled = false,
  updateTooltip = "",
  showSearch = true,
  showAdd = true,
  showUpdate = true,
  showFilter = true,
  searchPlaceholder = "Search...",
}) => {
  const [internalSelected, setInternalSelected] = useState(null);
  const [renderLoader, setRenderLoader] = useState(Boolean(loading));
  const sel = selectedRows ?? internalSelected;
  const setSel = setSelectedRows ?? setInternalSelected;
  const dataLength = Array.isArray(data) ? data.length : 0;
  const loaderStartedAtRef = useRef(loading ? Date.now() : 0);

  useEffect(() => {
    let timeoutId = null;

    if (loading) {
      loaderStartedAtRef.current = Date.now();
      setRenderLoader(true);
    } else {
      const elapsed = Date.now() - loaderStartedAtRef.current;
      const waitFor = Math.max(0, 160 - elapsed);
      timeoutId = setTimeout(() => setRenderLoader(false), waitFor);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading]);

  const showEmptyState = !renderLoader && dataLength === 0;
  const showTable = !renderLoader && !showEmptyState && (table || columns?.length > 0);

  const TableLoader = () => (
    <div className="absolute inset-0 grid place-items-center bg-white/70">
      <video
        src={loaderVideo}
        autoPlay
        loop
        muted
        playsInline
        className="w-40 h-40"
      />
    </div>
  );

  const handleRowSelect = (id) => {
    setSel((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-w-0 px-2 py-3 sm:px-4 sm:py-4 lg:px-5">
      <TopBar
        title={title}
        onAdd={onAdd}
        onUpdate={sel ? () => onUpdate(sel) : null}
        onFilter={onFilter}
        disableUpdate={sel === null || updateDisabled}
        updateTooltip={updateTooltip}
        onSearch={onSearch}
        searchValue={searchValue}
        actions={actions} // <— add this
        showSearch={showSearch}
        showAdd={showAdd}
        showUpdate={showUpdate}
        showFilter={showFilter}
        searchPlaceholder={searchPlaceholder}
      />
      {aboveContent}
      {/* Only render the built-in table when columns exist */}
      {/* // ? From the below line i have removed the min-h-[320px] because there is gap bertween the daybook item and serials table. */}
      
      <div
        className={`mt-4 rounded-lg relative ${
          renderLoader ? "min-h-[300px] sm:min-h-[360px] lg:min-h-[calc(100vh-260px)]" : ""
        }`}
      >
        {renderLoader ? (
          <TableLoader />
        ) : showEmptyState ? (
          <div className="flex flex-col items-center justify-center py-12">
            <img
              src={noData}
              alt="No records found"
              className="w-[min(85vw,22rem)] opacity-80 sm:w-[min(70vw,24rem)]"
            />
            <p className="mt-3 text-gray-500 text-sm">No records found</p>
          </div>
        ) : showTable ? (
          <div className="overflow-x-auto w-full">
            {table ? (
              table
            ) : (
              <ListTable
                columns={columns || []}
                data={data || []}
                selectedRows={sel}
                /* Pass onRowSelect ONLY if selection is controlled by parent */
                onRowSelect={setSelectedRows ? handleRowSelect : undefined}
                idCol={idCol}
                onRowClick={onRowClick}
              />
            )}
          </div>
        ) : null}
      </div>
      {belowContent}
    </div>
  );
};

export default ListPage;
