import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgeCheck,
  KeyRound,
  LoaderCircle,
  LogOut,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { fetchMyProfile } from "@/lib/profile-api";
import { signOutAndRedirect } from "@/lib/session";

const toDisplay = (value, fallback = "Not available") => {
  const text = String(value || "").trim();
  return text || fallback;
};

const formatDisplayLabel = (value, fallback = "Not available") => {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatRoleLabel = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function AccountProfilePopover({
  children,
  fallbackName = "Account Holder",
  fallbackInitials = "AH",
  onAction = null,
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || profile) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    fetchMyProfile()
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Live account details could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, profile]);

  const account = profile?.account || {};
  const employee = profile?.employee || {};
  const permissions = profile?.permissions || {};
  const displayName = toDisplay(account.fullname, fallbackName);
  const primaryLocation = Array.isArray(permissions.location_scopes)
    ? permissions.location_scopes[0]
    : "";

  const rolePreview = useMemo(
    () =>
      (Array.isArray(account.roles) ? account.roles : []).slice(0, 3),
    [account.roles],
  );

  const handleNavigate = (path) => {
    setOpen(false);
    if (typeof onAction === "function") {
      onAction();
    }
    navigate(path);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={14}
        className="w-[22rem] overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-0 shadow-[0_36px_80px_-36px_rgba(15,23,42,0.5)] backdrop-blur-xl"
      >
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.16),_transparent_35%)]" />
          <div className="relative space-y-4 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-slate-950 text-lg font-semibold text-white shadow-[0_16px_30px_-18px_rgba(15,23,42,0.7)]">
                {fallbackInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Account Hub
                </div>
                <h3 className="mt-3 truncate text-lg font-semibold text-slate-900">
                  {displayName}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {toDisplay(account.designation || employee.designation)}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3.5 py-3 text-sm text-slate-600">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading account details...
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white/85 px-3.5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Employee Code
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {toDisplay(account.empcode)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/85 px-3.5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Primary Location
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {formatDisplayLabel(primaryLocation)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 rounded-[1.5rem] border border-slate-200 bg-white/85 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-sky-600" />
                    Access Snapshot
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rolePreview.length ? (
                      rolePreview.map((role) => (
                        <span
                          key={role}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                        >
                          {formatRoleLabel(role)}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">
                        Roles will appear here after the profile loads.
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2.5 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-slate-400" />
                      <span>
                        {formatDisplayLabel(
                          account.division || employee.division,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span>
                        {formatDisplayLabel(
                          employee.office_location || primaryLocation,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BadgeCheck className="h-4 w-4 text-slate-400" />
                      <span>
                        {Array.isArray(permissions.assignments)
                          ? `${permissions.assignments.length} access assignment${permissions.assignments.length === 1 ? "" : "s"}`
                          : "No access assignments"}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {error ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
                {error}
              </div>
            ) : null}

            <div className="grid gap-2.5">
              <Button
                type="button"
                onClick={() => handleNavigate("/profile")}
                className="h-11 rounded-xl bg-slate-950 text-sm font-semibold text-white hover:bg-slate-800"
              >
                View Full Profile
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleNavigate("/profile?tab=security&changePassword=1")}
                className="h-11 rounded-xl border-slate-200 text-sm font-semibold"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Change Password
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  if (typeof onAction === "function") {
                    onAction();
                  }
                  signOutAndRedirect("/login");
                }}
                className="h-11 rounded-xl text-sm font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
