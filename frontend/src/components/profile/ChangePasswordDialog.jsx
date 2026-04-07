import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changeMyPassword } from "@/lib/profile-api";
import { getPasswordRuleStates } from "@/lib/password-policy";
import { storeLocalSessionIdentity } from "@/lib/session";

const TEMPORARY_PROVISIONING_PASSWORD = String(
  import.meta.env.VITE_EMPLOYEE_PROVISION_DEFAULT_PASSWORD || "",
).trim();

const INITIAL_FORM = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ChangePasswordDialog({
  open,
  onOpenChange,
  onSuccess,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setSubmitting(false);
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  }, [open]);

  const passwordRuleStates = useMemo(
    () => getPasswordRuleStates(form.newPassword),
    [form.newPassword],
  );

  const confirmMatches =
    Boolean(form.confirmPassword) && form.newPassword === form.confirmPassword;
  const differsFromCurrentPassword =
    Boolean(form.newPassword) &&
    Boolean(form.currentPassword) &&
    form.newPassword !== form.currentPassword;
  const differsFromProvisioningPassword =
    !TEMPORARY_PROVISIONING_PASSWORD ||
    (Boolean(form.newPassword) &&
      form.newPassword !== TEMPORARY_PROVISIONING_PASSWORD);

  const canSubmit =
    Boolean(form.currentPassword) &&
    Boolean(form.newPassword) &&
    Boolean(form.confirmPassword) &&
    passwordRuleStates.every((rule) => rule.passed) &&
    confirmMatches &&
    differsFromCurrentPassword &&
    differsFromProvisioningPassword;

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const payload = await changeMyPassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });

      const data = payload?.data || {};
      storeLocalSessionIdentity({
        fullName: data?.fullName,
        roles: Array.isArray(data?.roles) ? data.roles : [],
      });

      onSuccess?.(payload);
      onOpenChange(false);
    } catch {
      // Global network handling and page-level popups already surface API errors.
    } finally {
      setSubmitting(false);
    }
  };

  const ruleRows = [
    ...passwordRuleStates,
    {
      id: "confirm-match",
      label: "New password and confirm password must match",
      passed: confirmMatches,
    },
    {
      id: "different-current",
      label: "Must be different from your current password",
      passed: differsFromCurrentPassword,
    },
    {
      id: "different-default",
      label: "Must not match the provisioning password",
      passed: differsFromProvisioningPassword,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1.5rem)] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white p-0 shadow-[0_42px_100px_-40px_rgba(15,23,42,0.58)] sm:max-w-4xl">
        <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="relative overflow-hidden border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_38%),linear-gradient(145deg,_rgba(248,250,252,0.92),_rgba(255,255,255,0.98))] px-6 py-6 sm:px-8 lg:border-b-0 lg:border-r">
            <div className="absolute right-[-4rem] top-[-4rem] h-32 w-32 rounded-full bg-sky-200/45 blur-3xl" />
            <div className="absolute bottom-[-4rem] left-[-2rem] h-28 w-28 rounded-full bg-emerald-200/35 blur-3xl" />

            <DialogHeader className="relative text-left">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Password Security
              </div>
              <DialogTitle className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
                Refresh your sign-in password
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm leading-6 text-slate-600">
                This reuses the secure Auth password update flow. We’ll validate the
                policy again on save, refresh your session, and keep the account
                protected.
              </DialogDescription>
            </DialogHeader>

            <div className="relative mt-6 space-y-3">
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_36px_-24px_rgba(15,23,42,0.35)]">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <LockKeyhole className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Session stays active
                    </p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      Once the update succeeds, the existing secure session is
                      refreshed automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-4 shadow-[0_16px_36px_-24px_rgba(15,23,42,0.35)]">
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Reusable security path
                    </p>
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      This same backend flow is ready to support your future profile
                      password-change area as well.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white px-6 py-6 sm:px-8">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Current password
                </label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="Enter your current password"
                    className="h-12 rounded-xl border-slate-300 pr-12"
                    value={form.currentPassword}
                    onChange={(event) =>
                      updateField("currentPassword", event.target.value)
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowCurrentPassword((current) => !current)
                    }
                    className="absolute inset-y-0 right-0 inline-flex items-center px-4 text-slate-500 transition hover:text-slate-700"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    New password
                  </label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Create a new password"
                      className="h-12 rounded-xl border-slate-300 pr-12"
                      value={form.newPassword}
                      onChange={(event) =>
                        updateField("newPassword", event.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 inline-flex items-center px-4 text-slate-500 transition hover:text-slate-700"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your new password"
                      className="h-12 rounded-xl border-slate-300 pr-12"
                      value={form.confirmPassword}
                      onChange={(event) =>
                        updateField("confirmPassword", event.target.value)
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((current) => !current)
                      }
                      className="absolute inset-y-0 right-0 inline-flex items-center px-4 text-slate-500 transition hover:text-slate-700"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-700" />
                  <p className="text-sm font-semibold text-slate-900">
                    Password requirements
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ruleRows.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[12.5px] leading-[1.05rem] text-slate-700 shadow-sm"
                    >
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                        {rule.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-500" />
                        )}
                      </span>
                      <span>{rule.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="h-11 rounded-xl border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Updating password...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
