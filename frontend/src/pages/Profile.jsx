import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  Clock3,
  Fingerprint,
  Globe2,
  IdCard,
  KeyRound,
  LaptopMinimal,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPinned,
  Phone,
  RefreshCcw,
  ShieldCheck,
  ShieldEllipsis,
  Sparkles,
  UserRound,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PopupMessage from "@/components/PopupMessage";
import ChangePasswordDialog from "@/components/profile/ChangePasswordDialog";
import ReadOnlyField, {
  DEFAULT_READ_ONLY_MESSAGE,
} from "@/components/profile/ReadOnlyField";
import { fetchMyProfile } from "@/lib/profile-api";
import { cn } from "@/lib/utils";

const formatDateTime = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const titleCase = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeText = (value, fallback = "Not available") => {
  const text = String(value || "").trim();
  return text || fallback;
};

const listToText = (value, formatter = titleCase, fallback = "Not available") => {
  if (!Array.isArray(value) || !value.length) return fallback;
  return value.map((entry) => formatter(entry)).join(", ");
};

const getInitials = (fullName) => {
  const words = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "AH";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return `${words[0].slice(0, 1)}${words[words.length - 1].slice(0, 1)}`.toUpperCase();
};

const formatAssignment = (assignment = {}) => {
  const typeLabel = titleCase(
    String(assignment.assignment_type || "").replace(/_/g, " "),
  );
  const scopeLabel = normalizeText(
    assignment.scope_label || assignment.scope_key,
    "Organization",
  );
  return `${typeLabel} • ${scopeLabel}`;
};

const getEditableMessage = (profile, scope, field) =>
  profile?.security?.editable_fields?.[scope]?.[field]?.message ||
  DEFAULT_READ_ONLY_MESSAGE;

const formatDisplayLabel = (value) => titleCase(normalizeText(value));

const buildHeroBadgeText = (label, value) =>
  `${label} · ${formatDisplayLabel(value)}`;

function SectionShell({
  eyebrow,
  title,
  description,
  action = null,
  children,
  className = "",
}) {
  return (
    <div
      className={cn(
        "rounded-[1.8rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.42)] backdrop-blur-xl sm:p-6",
        className,
      )}
    >
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-700">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function HeroMetric({ icon: Icon, label, value, accentClass }) {
  return (
    <div className="rounded-[1.4rem] border border-white/70 bg-white/70 px-4 py-3 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-sm">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        <span
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900 text-white",
            accentClass,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      <p className="mt-3 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_32px_90px_-46px_rgba(15,23,42,0.4)]">
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-4">
            <Skeleton className="h-8 w-40 rounded-full" />
            <Skeleton className="h-10 w-[65%]" />
            <Skeleton className="h-5 w-[82%]" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-[1.4rem]" />
              ))}
            </div>
          </div>
          <Skeleton className="h-52 rounded-[1.7rem]" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-80 rounded-[1.8rem]" />
        ))}
      </div>
    </div>
  );
}

export default function Profile() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
    moveTo: "",
    diagnostic: null,
  });

  const currentTab =
    String(searchParams.get("tab") || "").trim().toLowerCase() === "security"
      ? "security"
      : "overview";
  const passwordDialogOpen = searchParams.get("changePassword") === "1";

  const account = profile?.account || {};
  const employee = profile?.employee || {};
  const permissions = profile?.permissions || {};
  const session = profile?.session || {};
  const device = session?.device || {};
  const security = profile?.security || {};

  const displayName = normalizeText(account.fullname || employee.name, "Account Holder");
  const displayDesignation = normalizeText(
    account.designation || employee.designation,
  );
  const displayDivision = normalizeText(account.division || employee.division);
  const primaryLocation = Array.isArray(permissions.location_scopes)
    ? permissions.location_scopes[0]
    : "";

  const roleNames = useMemo(
    () =>
      Array.isArray(account.roles)
        ? account.roles.map((role) =>
            typeof role === "string" ? role : role?.name,
          ).filter(Boolean)
        : [],
    [account.roles],
  );

  const assignmentLabels = useMemo(
    () =>
      Array.isArray(permissions.assignments)
        ? permissions.assignments.map((assignment) => formatAssignment(assignment))
        : [],
    [permissions.assignments],
  );

  const updateSearchParamState = useCallback(
    (updates = {}) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value == null || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const loadProfile = useCallback(
    async (mode = "full") => {
      if (mode === "refresh") {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const data = await fetchMyProfile();
        setProfile(data);
        setErrorMessage("");
      } catch (error) {
        const message =
          error?.response?.data?.message ||
          "We could not load the profile details right now.";
        setErrorMessage(message);
      } finally {
        if (mode === "refresh") {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const openChangePassword = () =>
    updateSearchParamState({
      tab: "security",
      changePassword: "1",
    });

  const handlePasswordDialogChange = (open) => {
    updateSearchParamState({
      tab: "security",
      changePassword: open ? "1" : null,
    });
  };

  const handleTabChange = (value) => {
    updateSearchParamState({
      tab: value === "security" ? "security" : null,
      changePassword: value === "security" ? searchParams.get("changePassword") : null,
    });
  };

  const handlePasswordChangeSuccess = async (payload) => {
    await loadProfile("refresh");
    setPopup({
      open: true,
      type: "success",
      message:
        payload?.message ||
        "Password updated successfully. Your account remains signed in with a refreshed session.",
      moveTo: "",
      diagnostic: null,
    });
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6 pb-6">
      <Motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_30%),linear-gradient(145deg,_rgba(255,255,255,0.96),_rgba(248,250,252,0.92))] p-6 shadow-[0_34px_100px_-52px_rgba(15,23,42,0.48)] sm:p-8"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute right-[-4rem] top-[-5rem] h-36 w-36 rounded-full bg-sky-200/35 blur-3xl" />
          <div className="absolute bottom-[-5rem] left-[28%] h-40 w-40 rounded-full bg-emerald-200/30 blur-3xl" />
        </div>

        <div className="relative grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
              <Sparkles className="h-3.5 w-3.5" />
              Profile Hub
            </div>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.7rem] bg-slate-950 text-2xl font-semibold text-white shadow-[0_20px_40px_-24px_rgba(15,23,42,0.65)]">
                {getInitials(displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-slate-950 sm:text-[2.2rem]">
                  {displayName}
                </h1>
                <p className="mt-2 max-w-3xl text-[15px] leading-7 text-slate-600">
                  A single view of your account, employment record, and active
                  session context across HARTRON Store. Every detail shown here is
                  aligned to the services that currently own it.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-sm font-medium text-slate-700">
                    {buildHeroBadgeText("Designation", displayDesignation)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-sm font-medium text-slate-700">
                    {buildHeroBadgeText("Division", displayDivision)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-sm font-medium text-slate-700">
                    {buildHeroBadgeText(
                      "Location",
                      primaryLocation || employee.office_location,
                    )}
                  </span>
                  {roleNames.slice(0, 3).map((role) => (
                    <span
                      key={role}
                      className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700"
                    >
                      {buildHeroBadgeText(
                        "Role",
                        titleCase(String(role).replace(/_/g, " ")),
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroMetric
                icon={IdCard}
                label="Employee Code"
                value={normalizeText(account.empcode)}
              />
              <HeroMetric
                icon={Building2}
                label="Division"
                value={displayDivision}
                accentClass="bg-sky-700"
              />
              <HeroMetric
                icon={MapPinned}
                label="Primary Scope"
                value={formatDisplayLabel(
                  primaryLocation || employee.office_location,
                )}
                accentClass="bg-emerald-600"
              />
              <HeroMetric
                icon={BadgeCheck}
                label="Role Coverage"
                value={`${roleNames.length || 0} active role${roleNames.length === 1 ? "" : "s"}`}
                accentClass="bg-amber-500"
              />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/70 bg-white/78 p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.42)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Security Snapshot
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">
                  Current session and account protection
                </h2>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                  security.must_change_password
                    ? "border border-amber-200 bg-amber-50 text-amber-700"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-700",
                )}
              >
                {security.must_change_password ? "Attention Needed" : "Healthy Session"}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <LaptopMinimal className="h-4 w-4 text-slate-500" />
                  Current device
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {normalizeText(device.browser)} on {normalizeText(device.operating_system)} •{" "}
                  {normalizeText(device.device_type)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  IP {normalizeText(device.ip_address)} • Session expires{" "}
                  {formatDateTime(session.expires_at)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <LockKeyhole className="h-4 w-4 text-slate-500" />
                  Password status
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Last updated {formatDateTime(security.password_changed_at)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Need a fresh sign-in secret? Reuse the secure Auth password change
                  flow here.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <Button
                type="button"
                onClick={openChangePassword}
                className="h-11 flex-1 rounded-xl bg-slate-950 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Change Password
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => loadProfile("refresh")}
                disabled={refreshing}
                className="h-11 rounded-xl border-slate-200 text-sm font-semibold"
              >
                {refreshing ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </Motion.section>

      {errorMessage ? (
        <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
          {errorMessage}
        </div>
      ) : null}

      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-5">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-[1.35rem] bg-white/80 p-1.5 ring-1 ring-slate-200/80 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.3)] sm:w-fit">
          <TabsTrigger
            value="overview"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold data-[state=active]:bg-slate-950 data-[state=active]:text-white"
          >
            Security & Session
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SectionShell
            eyebrow="Admin Managed"
            title="Profile information is visible here, but still centrally managed"
            description="We’re exposing your account and employee data in one place now. Editing remains disabled in phase one, so each field shows a read-only indicator and the admin-managed guidance on hover."
          >
            <div className="rounded-[1.4rem] border border-slate-200/80 bg-slate-50/85 px-4 py-3 text-sm leading-6 text-slate-600">
              Hover any pencil icon to see the current editing policy. For now,
              updates to these fields can only be made by the database admin.
            </div>
          </SectionShell>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionShell
              eyebrow="Auth Service"
              title="Account Identity"
              description="These are the account-facing values that drive sign-in, role resolution, and high-level access context."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField
                  label="Full Name"
                  value={account.fullname}
                  message={getEditableMessage(profile, "account", "fullname")}
                />
                <ReadOnlyField
                  label="Login Mobile"
                  value={account.mobileno}
                  message={getEditableMessage(profile, "account", "mobileno")}
                />
                <ReadOnlyField
                  label="Employee Code"
                  value={account.empcode}
                  helperText="Used as the account-to-employee bridge across the services."
                  showEditHint={false}
                />
                <ReadOnlyField
                  label="Designation"
                  value={account.designation}
                  message={getEditableMessage(profile, "account", "designation")}
                />
                <ReadOnlyField
                  label="Division"
                  value={account.division}
                  message={getEditableMessage(profile, "account", "division")}
                />
                <ReadOnlyField
                  label="Roles"
                  value={listToText(roleNames, (role) =>
                    titleCase(String(role).replace(/_/g, " ")),
                  )}
                  helperText="Role assignments continue to be controlled through your authorization setup."
                  showEditHint={false}
                />
              </div>
            </SectionShell>

            <SectionShell
              eyebrow="Store Service"
              title="Employee Master Details"
              description="These values come from the employee master record in the Store service."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField
                  label="Employee Name"
                  value={employee.name}
                  message={getEditableMessage(profile, "employee", "name")}
                />
                <ReadOnlyField
                  label="Father Name"
                  value={employee.father_name}
                  message={getEditableMessage(profile, "employee", "father_name")}
                />
                <ReadOnlyField
                  label="Office Email"
                  value={employee.email_id}
                  message={getEditableMessage(profile, "employee", "email_id")}
                />
                <ReadOnlyField
                  label="Office Mobile"
                  value={employee.mobile_no}
                  message={getEditableMessage(profile, "employee", "mobile_no")}
                />
                <ReadOnlyField
                  label="Gender"
                  value={employee.gender}
                  message={getEditableMessage(profile, "employee", "gender")}
                />
                <ReadOnlyField
                  label="Office Location"
                  value={employee.office_location}
                  message={getEditableMessage(profile, "employee", "office_location")}
                />
              </div>
            </SectionShell>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionShell
              eyebrow="Access Context"
              title="Permissions and runtime footprint"
              description="A human-friendly snapshot of the scopes and assignments that are currently shaping your runtime access."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField
                  label="Location Scopes"
                  value={listToText(permissions.location_scopes)}
                  helperText="Resolved from explicit scope assignment, organizational assignment, or employee location fallback."
                  showEditHint={false}
                />
                <ReadOnlyField
                  label="Scope Source"
                  value={titleCase(
                    String(permissions.location_scope_source || "resolved")
                      .replace(/_/g, " "),
                  )}
                  showEditHint={false}
                />
                <ReadOnlyField
                  label="Assignments"
                  value={
                    assignmentLabels.length
                      ? assignmentLabels.length
                      : "No active assignments"
                  }
                  helperText={
                    assignmentLabels.length
                      ? assignmentLabels.join(" | ")
                      : "No org assignment records are currently attached to this account."
                  }
                  showEditHint={false}
                />
                <ReadOnlyField
                  label="Session Access Mode"
                  value={`${normalizeText(session.auth_mode)} • ${normalizeText(session.token_source)}`}
                  helperText="This reflects how the active browser session is currently authenticated."
                  showEditHint={false}
                />
              </div>
            </SectionShell>

            <SectionShell
              eyebrow="Support Guidance"
              title="What you can do right now"
              description="Phase one focuses on visibility, security, and confidence. Edits stay locked for now, while password change and session awareness are fully available."
            >
              <div className="space-y-3">
                <div className="rounded-[1.35rem] border border-slate-200/80 bg-slate-50/90 p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <ShieldEllipsis className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Field editing is intentionally paused
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        We’re surfacing your data cleanly first. Until the edit
                        workflow arrives, changes to profile fields can only be
                        made by the database admin.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.35rem] border border-slate-200/80 bg-slate-50/90 p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                      <KeyRound className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Password change is already live
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        The profile page now reuses the secure Auth password change
                        flow, so you can rotate your sign-in password here without
                        waiting for later profile phases.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </SectionShell>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
            <SectionShell
              eyebrow="Password Controls"
              title="Security posture"
              description="This area keeps the account protection story clear: password state, session timing, and the live device snapshot are all visible in one place."
              action={
                <Button
                  type="button"
                  onClick={openChangePassword}
                  className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Change Password
                </Button>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField
                  label="Password Status"
                  value={
                    security.must_change_password
                      ? "Password change required"
                      : "Private password active"
                  }
                  helperText="Auth blocks app access automatically whenever a password change becomes mandatory."
                  showEditHint={false}
                />
                <ReadOnlyField
                  label="Last Password Change"
                  value={formatDateTime(security.password_changed_at)}
                  showEditHint={false}
                />
                <ReadOnlyField
                  label="Session Issued"
                  value={formatDateTime(session.issued_at)}
                  showEditHint={false}
                />
                <ReadOnlyField
                  label="Session Expires"
                  value={formatDateTime(session.expires_at)}
                  showEditHint={false}
                />
              </div>
              {session.status_reason ? (
                <div className="mt-4 rounded-[1.35rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {normalizeText(session.status_reason.message)}{" "}
                  {session.status_reason.hint
                    ? ` ${normalizeText(session.status_reason.hint)}`
                    : ""}
                </div>
              ) : null}
            </SectionShell>

            <SectionShell
              eyebrow="Current Device"
              title="Session and device details"
              description="A practical snapshot of the browser, device class, and active runtime metadata for the session you are using right now."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField
                  label="Browser"
                  value={device.browser}
                  helperText="Detected from the current browser user-agent."
                  showEditHint={false}
                />
                <ReadOnlyField
                  label="Operating System"
                  value={device.operating_system}
                  showEditHint={false}
                />
                <ReadOnlyField
                  label="Device Type"
                  value={device.device_type}
                  showEditHint={false}
                />
                <ReadOnlyField
                  label="Preferred Language"
                  value={device.language}
                  showEditHint={false}
                />
                <ReadOnlyField
                  label="IP Address"
                  value={device.ip_address}
                  showEditHint={false}
                />
                <ReadOnlyField
                  label="Forwarded For"
                  value={device.forwarded_for}
                  showEditHint={false}
                />
              </div>
            </SectionShell>
          </div>

          <SectionShell
            eyebrow="Runtime Detail"
            title="Full session fingerprint"
            description="Useful when you need to confirm exactly what the application thinks your current browser and session look like."
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <ReadOnlyField
                label="Auth Mode"
                value={session.auth_mode}
                className="h-full"
                showEditHint={false}
              />
              <ReadOnlyField
                label="Token Source"
                value={session.token_source}
                className="h-full"
                showEditHint={false}
              />
              <ReadOnlyField
                label="Server Time"
                value={formatDateTime(session.server_time)}
                className="h-full"
                showEditHint={false}
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.4rem] border border-slate-200/80 bg-slate-50/85 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Fingerprint className="h-4 w-4 text-slate-500" />
                  User agent string
                </div>
                <p className="mt-3 break-all text-sm leading-6 text-slate-600">
                  {normalizeText(device.user_agent)}
                </p>
              </div>

              <div className="rounded-[1.4rem] border border-slate-200/80 bg-slate-50/85 p-4">
                <div className="grid gap-3">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <CalendarClock className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Session lifetime
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {session.expires_in_seconds != null
                          ? `${session.expires_in_seconds} seconds remaining in the current session window.`
                          : "Session lifetime could not be calculated from the current token snapshot."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                      <Globe2 className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Session scope
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {listToText(permissions.location_scopes)} across{" "}
                        {assignmentLabels.length || 0} assignment-linked access
                        records.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionShell>
        </TabsContent>
      </Tabs>

      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={handlePasswordDialogChange}
        onSuccess={handlePasswordChangeSuccess}
      />

      <PopupMessage
        open={popup.open}
        type={popup.type}
        message={popup.message}
        moveTo={popup.moveTo}
        diagnostic={popup.diagnostic}
        onClose={() =>
          setPopup({
            open: false,
            type: "info",
            message: "",
            moveTo: "",
            diagnostic: null,
          })
        }
      />
    </div>
  );
}
