
import React, { useState } from "react";
import { Button } from "@/components/ui/button";

const TopBar = ({
  title,
  onAdd,
  onUpdate,
  onFilter,
  disableUpdate,
  updateTooltip = "",
  onSearch,
  searchValue = "",
  actions,
  showSearch = true,
  showAdd = true,
  showUpdate = true,
  showFilter = true,
  searchPlaceholder,
}) => {

  const [showTip, setShowTip] = useState(false);
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <h2 className="truncate text-lg font-semibold sm:text-xl">{title}</h2>
      {Array.isArray(actions) && actions.length > 0 ? (
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={a.onClick}
              className="h-9 rounded bg-slate-900 px-3 text-xs text-white hover:bg-slate-800 sm:text-sm"
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex w-full flex-wrap items-center gap-2 overflow-visible lg:w-auto lg:justify-end">
        {showSearch && (
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearch?.(e.target.value)}
            className="h-9 w-full min-w-0 flex-1 rounded border px-3 text-sm lg:w-72 lg:flex-none"
            placeholder={searchPlaceholder}
          />
        )}

        <div className="relative">
          {showFilter && (
            <Button className="h-9 cursor-pointer px-3 text-xs sm:text-sm" onClick={onFilter}>
              Filter
            </Button>
          )}
        </div>
        {showAdd && (
          <Button className="h-9 cursor-pointer px-3 text-xs sm:text-sm" onClick={onAdd}>
            + Add
          </Button>
        )}

        {showUpdate && (
          <span
            className="relative inline-flex shrink-0"
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
          >
            <Button
              className="h-9 px-3 text-xs sm:text-sm"
              onClick={onUpdate}
              disabled={disableUpdate}
            >
              Update
            </Button>

            {disableUpdate && updateTooltip && showTip && (
              <div
                className="absolute z-50 top-full right-0 mt-1
        bg-black text-white text-xs px-2 py-1 rounded shadow-lg
        max-w-[220px] whitespace-normal break-words"
              >
                {updateTooltip}
              </div>
            )}
          </span>
        )}
      </div>
    </div>
  );
};

export default TopBar;
