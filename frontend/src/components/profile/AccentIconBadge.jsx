import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  slate: "bg-slate-950 text-white ring-slate-900/5",
  sky: "bg-sky-700 text-white ring-sky-700/10",
  emerald: "bg-emerald-600 text-white ring-emerald-600/10",
  amber: "bg-amber-500 text-white ring-amber-500/10",
};

export default function AccentIconBadge({
  icon,
  tone = "slate",
  className = "",
  iconClassName = "",
}) {
  const IconComponent = icon;

  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.05rem] ring-1 shadow-[0_10px_22px_-16px_rgba(15,23,42,0.55)]",
        TONE_CLASSES[tone] || TONE_CLASSES.slate,
        className,
      )}
    >
      <IconComponent
        className={cn("h-[18px] w-[18px] stroke-[2.1]", iconClassName)}
      />
    </span>
  );
}
