import React, { useRef, useState, useEffect, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronUp, ChevronDown } from "lucide-react";

/* ----------------- Helpers ----------------- */

function Chip({ label, color = "gray", emoji }) {
  const map = {
    gray: "bg-gray-200 text-gray-700",
    green: "bg-green-200 text-green-700",
    red: "bg-red-200 text-red-700",
    yellow: "bg-yellow-200 text-yellow-800",
    indigo: "bg-indigo-200 text-indigo-700",
    purple: "bg-purple-200 text-purple-700",
    blue: "bg-blue-200 text-blue-700",
    "red-dark": "bg-red-800 text-white",
  };

  return (
    <span
      className={` inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${map[color]}`}
    >
      {emoji && <span>{emoji}</span>}
      {label}
    </span>
  );
}

function DottedProgress({ value = 0, max = 4, color = "blue" }) {
  const colors = {
    gray: "bg-gray-400",
    yellow: "bg-yellow-400",
    indigo: "bg-indigo-500",
    purple: "bg-purple-500",
    green: "bg-green-500",
    blue: "bg-blue-500",
  };

  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${i < value ? colors[color] : "bg-gray-200"}`}
        />
      ))}
    </div>
  );
}

/* ----------------- Table ----------------- */

// ? Helper for the skelton rows
function SkeletonRow({ columns, onRowSelect }) {
  return (
    <tr className="animate-pulse">
      {onRowSelect && (
        <td className="px-3 py-3">
          <div className="h-4 w-4 bg-gray-200 rounded" />
        </td>
      )}
      {columns.map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

export default function ListTable({
  columns = [],
  data = [],
  idCol = "id",
  selectedRows = null,
  onRowSelect,
  onRowClick,
  onLoadMore,
  hasMore,
  loading,
  virtualStartIndex = 0,
}) {
  const parentRef = useRef(null);
  const loadLockRef = useRef(false);
  const pointerStateRef = useRef({
    startX: 0,
    startY: 0,
    moved: false,
  });
  const dragPanRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    pointerX: 0,
    pointerY: 0,
    moveHandler: null,
    upHandler: null,
    rafId: null,
  });
  const [sortConfig, setSortConfig] = useState(null);
  const [focusedRowId, setFocusedRowId] = useState(null);

  const ROW_HEIGHT = 52;
  const VIRTUAL_THRESHOLD = 12;
  const DRAG_THRESHOLD_PX = 8;
  const AUTO_PAN_MAX_SPEED = 18;
  const AUTO_PAN_DIVISOR = 16;
  const shouldVirtualize = data.length > VIRTUAL_THRESHOLD;


  const prevLengthRef = useRef(0);

  useEffect(() => {
    // scroll to top only when list is RESET (filters/search)
    if (data.length < prevLengthRef.current) {
      parentRef.current?.scrollTo({ top: 0 });
    }
    prevLengthRef.current = data.length;
  }, [data]);

  useEffect(() => {
    if (!loading) {
      loadLockRef.current = false;
    }
  }, [loading]);

  // scroll to near bottom load next page
  useEffect(() => {
    if (!onLoadMore || !hasMore) return;

    const el = parentRef.current;
    if (!el) return;

    let rafId = 0;
    const handleScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const { scrollTop, scrollHeight, clientHeight } = el;

        if (
          scrollHeight - scrollTop - clientHeight < 240 &&
          !loading &&
          hasMore &&
          !loadLockRef.current
        ) {
          loadLockRef.current = true;
          onLoadMore();
        }
      });
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [onLoadMore, hasMore, loading]);


  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    const { key, direction } = sortConfig;
    const multiplier = direction === "asc" ? 1 : -1;

    return [...data].sort((a, b) => {
      const av = a?.[key];
      const bv = b?.[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * multiplier;
      }

      return String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * multiplier;
    });
  }, [data, sortConfig]);

  const toggleSort = (key) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  /* 🧠 Virtualizer */
  const rowVirtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
    enabled: shouldVirtualize,
    getItemKey: (index) => sortedData[index]?.[idCol] ?? index,
  });

  const virtualRows = shouldVirtualize
    ? rowVirtualizer.getVirtualItems()
    : sortedData.map((_, i) => ({ index: i }));

  const paddingTop =
    shouldVirtualize && virtualRows.length > 0 ? virtualRows[0].start : 0;

  const paddingBottom =
    shouldVirtualize && virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;
  const virtualOffsetTop =
    shouldVirtualize && Number.isFinite(Number(virtualStartIndex))
      ? Math.max(0, Number(virtualStartIndex)) * ROW_HEIGHT
      : 0;

  const getRowClass = (row) => {
    if (row.status === "PENDING_SIGNATURE")
      return "bg-red-100 border-l-4 border-red-500";
    if (row.status === "SIGNED_UPLOADED")
      return "bg-green-100 border-l-4 border-green-500";
    if (row.store_progress === "Pending")
      return "bg-yellow-100 border-l-4 border-yellow-400";
    if (row.status === "Rejected")
      return "bg-red-100 border-l-4 border-red-500";
    if (
      row.status === "Approved" ||
      row.store_progress === "Worked" ||
      row.status === "Fulfilled"
    )
      return "bg-green-100 border-l-4 border-green-500";
    if (row.status === "MRN Cancelled")
      return "bg-red-400 border-l-4 border-red-800";

    const lvl = Number(row.approval_level);
    if (lvl === 1) return "bg-yellow-100 border-l-4 border-yellow-400";
    if (lvl === 2) return "bg-indigo-100 border-l-4 border-indigo-500";
    if (lvl === 3) return "bg-green-100 border-l-4 border-green-500";

    return "bg-white border-l-4 border-gray-300";
  };

  const beginPointerTrack = (event) => {
    pointerStateRef.current = {
      startX: event.clientX ?? 0,
      startY: event.clientY ?? 0,
      moved: false,
    };
  };

  const updatePointerTrack = (event) => {
    const dx = Math.abs((event.clientX ?? 0) - pointerStateRef.current.startX);
    const dy = Math.abs((event.clientY ?? 0) - pointerStateRef.current.startY);
    if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
      pointerStateRef.current.moved = true;
    }
  };

  const handleRowSingleClick = (rowId) => {
    if (pointerStateRef.current.moved) return;
    setFocusedRowId(rowId);
    onRowSelect?.(rowId);
  };

  const handleRowDoubleClick = (rowId) => {
    if (pointerStateRef.current.moved) return;
    onRowClick?.(rowId);
  };

  const isInteractiveTarget = (target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        "input, button, a, textarea, select, label, [role='button'], [data-no-drag-pan='true']",
      ),
    );
  };

  const detachDragPanListeners = () => {
    const { moveHandler, upHandler, rafId } = dragPanRef.current;
    if (moveHandler) window.removeEventListener("mousemove", moveHandler);
    if (upHandler) window.removeEventListener("mouseup", upHandler);
    if (rafId) cancelAnimationFrame(rafId);
    dragPanRef.current.moveHandler = null;
    dragPanRef.current.upHandler = null;
    dragPanRef.current.rafId = null;
    dragPanRef.current.active = false;
  };

  useEffect(() => {
    return () => detachDragPanListeners();
  }, []);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const startAutoPanLoop = () => {
    const tick = () => {
      const state = dragPanRef.current;
      if (!state.active) return;

      const host = parentRef.current;
      if (!host) return;

      const dx = state.pointerX - state.startX;
      const dy = state.pointerY - state.startY;

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx > DRAG_THRESHOLD_PX || absDy > DRAG_THRESHOLD_PX) {
        state.moved = true;
        pointerStateRef.current.moved = true;

        const vx = clamp(
          dx / AUTO_PAN_DIVISOR,
          -AUTO_PAN_MAX_SPEED,
          AUTO_PAN_MAX_SPEED,
        );
        const vy = clamp(
          dy / AUTO_PAN_DIVISOR,
          -AUTO_PAN_MAX_SPEED,
          AUTO_PAN_MAX_SPEED,
        );

        host.scrollLeft += vx;
        host.scrollTop += vy;
      }

      state.rafId = requestAnimationFrame(tick);
    };

    dragPanRef.current.rafId = requestAnimationFrame(tick);
  };

  const handleDragPanStart = (event) => {
    if (event.button !== 0 || isInteractiveTarget(event.target)) return;

    const host = parentRef.current;
    if (!host) return;

    dragPanRef.current = {
      active: true,
      moved: false,
      startX: event.clientX ?? 0,
      startY: event.clientY ?? 0,
      pointerX: event.clientX ?? 0,
      pointerY: event.clientY ?? 0,
      moveHandler: null,
      upHandler: null,
      rafId: null,
    };

    pointerStateRef.current = {
      startX: event.clientX ?? 0,
      startY: event.clientY ?? 0,
      moved: false,
    };

    const handleMove = (moveEvent) => {
      const state = dragPanRef.current;
      if (!state.active) return;

      state.pointerX = moveEvent.clientX ?? state.pointerX;
      state.pointerY = moveEvent.clientY ?? state.pointerY;

      if (state.moved) moveEvent.preventDefault();
    };

    const handleUp = () => {
      detachDragPanListeners();
    };

    dragPanRef.current.moveHandler = handleMove;
    dragPanRef.current.upHandler = handleUp;
    window.addEventListener("mousemove", handleMove, { passive: false });
    window.addEventListener("mouseup", handleUp);
    startAutoPanLoop();
  };

  return (
    <div
      className={`border border-gray-200 rounded-xl bg-white overflow-hidden ${
        shouldVirtualize ? "h-[62vh] sm:h-[68vh] lg:h-[72vh]" : ""
      }`}
    >
      <div
        ref={parentRef}
        className={`${shouldVirtualize ? "h-full" : ""} overflow-auto [scrollbar-gutter:stable]`}
        onMouseDown={handleDragPanStart}
      >
        <table className="min-w-[1100px] w-full text-sm border-collapse select-none">
          {/* COLGROUP */}
          <colgroup>
            {onRowSelect && <col style={{ width: 48 }} />}
            {columns.map((col) => (
              <col key={col.key} />
            ))}
          </colgroup>

          {/* HEADER */}
          <thead className="sticky top-0 z-20 bg-white border-b">
            <tr>
              {onRowSelect && (
                <th className="px-3 py-3 text-xs font-semibold text-gray-500 first:rounded-tl-xl">
                  Select
                </th>
              )}
              {columns.map((col, idx) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && toggleSort(col.key)}
                  className={`px-4 py-3 text-xs font-semibold uppercase text-gray-500 whitespace-nowrap cursor-pointer ${
                    idx === columns.length - 1 ? "rounded-tr-xl" : ""
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="flex flex-col">
                        <ChevronUp className="w-3 h-3" />
                        <ChevronDown className="w-3 h-3 -mt-1" />
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {virtualOffsetTop + paddingTop > 0 && (
              <tr>
                <td
                  colSpan={columns.length + (onRowSelect ? 1 : 0)}
                  style={{ height: virtualOffsetTop + paddingTop }}
                />
              </tr>
            )}

            {virtualRows.map((vr) => {
              const row = sortedData[vr.index];
              if (!row) return null;
              const isSelected = Array.isArray(selectedRows)
                ? selectedRows.includes(row[idCol])
                : selectedRows === row[idCol];
              const isFocused = focusedRowId === row[idCol];

              {
                /* const isLastRow =
                idx === virtualRows.length - 1 && paddingBottom === 0; */
              }

              const isRealLastRow =
                !hasMore && vr.index === sortedData.length - 1;

              return (
                <tr
                  key={`${row[idCol]}-${vr.index}`}
                  style={shouldVirtualize ? { height: ROW_HEIGHT } : undefined}
                  className={`${getRowClass(row)} ${
                    isSelected
                      ? "ring-2 ring-blue-400"
                      : isFocused
                        ? "ring-2 ring-sky-300"
                        : ""
                  } border-b border-gray-200 hover:bg-black/[0.03] ${
                    onRowClick || onRowSelect ? "cursor-pointer" : ""
                  }`}
                  onPointerDown={beginPointerTrack}
                  onPointerMove={updatePointerTrack}
                  onClick={() => handleRowSingleClick(row[idCol])}
                  onDoubleClick={() => handleRowDoubleClick(row[idCol])}
                >
                  {onRowSelect && (
                    <td
                      className={`px-3 py-3 ${isRealLastRow ? "rounded-bl-xl" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          onRowSelect(row[idCol]);
                        }}
                      />
                    </td>
                  )}

                  {columns.map((col, cIdx) => {
                    const value = row[col.key];
                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3 whitespace-nowrap ${
                          isRealLastRow && cIdx === columns.length - 1
                            ? "rounded-br-xl"
                            : ""
                        }`}
                      >
                        {col.chip ? (
                          <Chip
                            label={value ?? "-"}
                            {...(col.chipMap?.[value] || {})}
                          />
                        ) : col.progress ? (
                          <DottedProgress
                            value={Number(value)}
                            max={col.progress.max}
                            color={col.progress.colorMap?.[value]}
                          />
                        ) : col.render ? (
                          col.render(value, row)
                        ) : (
                          (value ?? "-")
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {paddingBottom > 0 && (
              <tr>
                <td
                  colSpan={columns.length + (onRowSelect ? 1 : 0)}
                  style={{ height: paddingBottom }}
                />
              </tr>
            )}
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow
                  key={`skeleton-${i}`}
                  columns={columns}
                  onRowSelect={onRowSelect}
                />
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
