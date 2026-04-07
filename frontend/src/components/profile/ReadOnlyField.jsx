import { Pencil } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const DEFAULT_READ_ONLY_MESSAGE =
  "Editing this field can currently be done only by the database admin. Please request database admin for any change.";

export default function ReadOnlyField({
  label,
  value,
  helperText = "",
  className = "",
  message = DEFAULT_READ_ONLY_MESSAGE,
  showEditHint = true,
}) {
  const displayValue =
    value == null || String(value).trim() === ""
      ? "Not available"
      : String(value);

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.35)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 break-words text-sm font-medium text-slate-900">
            {displayValue}
          </p>
          {helperText ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {helperText}
            </p>
          ) : null}
        </div>
        {showEditHint ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${label} is read only`}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-600"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[18rem]">
              {message}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

export { DEFAULT_READ_ONLY_MESSAGE };
