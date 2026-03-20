import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
} from "lucide-react";

const VARIANT_BY_TYPE = {
  success: {
    title: "Success",
    fallbackMessage: "Your action was completed successfully.",
    icon: CheckCircle2,
    iconClass: "text-emerald-700",
    iconWrapClass: "border-emerald-200 bg-emerald-50",
    titleClass: "text-emerald-950",
    messageClass: "text-emerald-900/85",
    headerBg: "bg-gradient-to-br from-emerald-50 via-emerald-100/80 to-white",
    ctaClass:
      "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-300",
    ctaLabel: "Done",
  },
  error: {
    title: "Action Required",
    fallbackMessage: "Something went wrong. Please try again.",
    icon: AlertCircle,
    iconClass: "text-rose-700",
    iconWrapClass: "border-rose-200 bg-rose-50",
    titleClass: "text-rose-950",
    messageClass: "text-rose-900/85",
    headerBg: "bg-gradient-to-br from-rose-50 via-rose-100/80 to-white",
    ctaClass:
      "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-300",
    ctaLabel: "Understood",
  },
  warning: {
    title: "Please Review",
    fallbackMessage: "Check the details before continuing.",
    icon: AlertTriangle,
    iconClass: "text-amber-700",
    iconWrapClass: "border-amber-200 bg-amber-50",
    titleClass: "text-amber-950",
    messageClass: "text-amber-900/85",
    headerBg: "bg-gradient-to-br from-amber-50 via-amber-100/80 to-white",
    ctaClass:
      "bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-300",
    ctaLabel: "Continue",
  },
  info: {
    title: "Information",
    fallbackMessage: "Here is an update for your request.",
    icon: Info,
    iconClass: "text-sky-700",
    iconWrapClass: "border-sky-200 bg-sky-50",
    titleClass: "text-sky-950",
    messageClass: "text-sky-900/85",
    headerBg: "bg-gradient-to-br from-sky-50 via-sky-100/80 to-white",
    ctaClass:
      "bg-sky-600 text-white hover:bg-sky-700 focus-visible:ring-sky-300",
    ctaLabel: "OK",
  },
};

const closeWithDelay = (fn) => {
  setTimeout(() => {
    if (typeof fn === "function") fn();
  }, 220);
};

const PopupMessage = ({ open, onClose, type, message, moveTo }) => {
  const [localOpen, setLocalOpen] = useState(open);
  const navigate = useNavigate();
  const normalizedType = String(type || "info").toLowerCase();
  const visual = VARIANT_BY_TYPE[normalizedType] || VARIANT_BY_TYPE.info;
  const Icon = visual.icon;

  useEffect(() => {
    setLocalOpen(open);
  }, [open]);

  const handleClose = () => {
    setLocalOpen(false);
    closeWithDelay(() => {
      if (typeof onClose === "function") onClose();
      if (typeof moveTo === "string" && moveTo.trim()) {
        navigate(moveTo);
      }
    });
  };

  const resolvedMessage =
    typeof message === "string" && message.trim()
      ? message.trim()
      : visual.fallbackMessage;

  if (!localOpen) return null;

  return (
    <Dialog open={localOpen} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <AnimatePresence>
        {localOpen ? (
          <Motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <DialogContent className="max-w-[30rem] overflow-hidden border border-slate-200/90 bg-white p-0 shadow-[0_28px_80px_-28px_rgba(15,23,42,0.55)]">
              <div className={`relative overflow-hidden px-6 pb-5 pt-6 sm:px-7 ${visual.headerBg}`}>
                <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-white/50 blur-2xl" />
                <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-white/40 blur-xl" />

                <DialogHeader className="relative space-y-0 text-left">
                  <div className="flex items-start gap-4">
                    <div
                      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm ring-4 ring-white/60 ${visual.iconWrapClass}`}
                    >
                      <Icon className={`h-5 w-5 ${visual.iconClass}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        <Sparkles className="h-3.5 w-3.5" />
                        System Message
                      </div>
                      <DialogTitle
                        className={`text-xl font-semibold tracking-tight ${visual.titleClass}`}
                      >
                        {visual.title}
                      </DialogTitle>
                      <DialogDescription className="sr-only">
                        {resolvedMessage}
                      </DialogDescription>
                      <p className={`mt-2 text-sm leading-6 ${visual.messageClass}`}>
                        {resolvedMessage}
                      </p>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="bg-gradient-to-b from-white to-slate-50/70 px-6 pb-6 pt-4 sm:px-7">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${visual.ctaClass}`}
                  >
                    {visual.ctaLabel}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Motion.div>
        ) : null}
      </AnimatePresence>
    </Dialog>
  );
};

export default PopupMessage;
