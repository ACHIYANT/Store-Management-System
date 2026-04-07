import { useMemo, useState } from "react";
import { motion as Motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import PopupMessage from "@/components/PopupMessage";
import { toAuthApiUrl } from "@/lib/api-config";
import {
  clearFirstLoginPasswordChangeContext,
  readFirstLoginPasswordChangeContext,
} from "@/lib/auth-password-change";
import { getPasswordRuleStates } from "@/lib/password-policy";
import {
  buildDiagnosticPresentation,
  buildDisplayMessage,
} from "@/lib/network";

import logo from "/logo.svg";
import govt from "/govt.svg";

const TEMPORARY_PROVISIONING_PASSWORD = String(
  import.meta.env.VITE_EMPLOYEE_PROVISION_DEFAULT_PASSWORD,
).trim();

const parseApiFeedback = async (response, fallbackMessage) => {
  try {
    const payload = await response.clone().json();
    const presentation = buildDiagnosticPresentation(
      {
        status: Number(response?.status || 0),
        url: toAuthApiUrl("/password/first-login/change"),
        code: payload?.code || payload?.err?.code,
        message:
          payload?.message || payload?.err?.message || payload?.data?.message,
        hint: payload?.hint,
        requestId: payload?.requestId || response.headers.get("x-request-id"),
        details: payload?.details,
      },
      fallbackMessage,
    );

    return {
      ...presentation,
      payload,
    };
  } catch {
    try {
      const text = await response.text();
      return {
        message: text || fallbackMessage,
        diagnostic: null,
        detail: null,
        payload: null,
      };
    } catch {
      return {
        message: fallbackMessage,
        diagnostic: null,
        detail: null,
        payload: null,
      };
    }
  }
};

export default function ResetPassword() {
  const context = readFirstLoginPasswordChangeContext();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
    moveTo: "",
    diagnostic: null,
  });

  const hasToken = Boolean(String(context?.passwordChangeToken || "").trim());
  const ruleStates = useMemo(
    () => getPasswordRuleStates(newPassword),
    [newPassword],
  );
  const passwordsMatch =
    Boolean(confirmPassword) && String(newPassword) === String(confirmPassword);
  const differsFromTemporaryPassword =
    Boolean(newPassword) &&
    String(newPassword) !== TEMPORARY_PROVISIONING_PASSWORD;
  const canSubmit =
    hasToken &&
    Boolean(newPassword) &&
    Boolean(confirmPassword) &&
    ruleStates.every((rule) => rule.passed) &&
    passwordsMatch &&
    differsFromTemporaryPassword;

  const showPopup = ({
    type = "info",
    message = "",
    moveTo = "",
    diagnostic = null,
  }) => {
    setPopup({ open: true, type, message, moveTo, diagnostic });
  };

  const clearLocalAuthState = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("fullname");
    localStorage.removeItem("roles");
    localStorage.removeItem("me");
  };

  const handleSubmit = async () => {
    if (!hasToken) {
      showPopup({
        type: "warning",
        message:
          "This password activation session is missing or has expired.\n\nPlease sign in again with your temporary password.",
        moveTo: "/login",
      });
      return;
    }

    if (!newPassword || !confirmPassword) {
      showPopup({
        type: "warning",
        message: "Please enter and confirm your new password.",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        toAuthApiUrl("/password/first-login/change"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            passwordChangeToken: context.passwordChangeToken,
            newPassword,
            confirmPassword,
          }),
        },
      );

      if (!response.ok) {
        const feedback = await parseApiFeedback(
          response,
          "Unable to change password. Please try again.",
        );
        showPopup({
          type: "error",
          message: feedback.message,
          diagnostic: feedback.diagnostic,
        });
        return;
      }

      const payload = await response.json();
      if (payload?.success && payload?.data) {
        clearLocalAuthState();
        clearFirstLoginPasswordChangeContext();
        showPopup({
          type: "success",
          message: `Password updated successfully${payload?.data?.fullName ? `, ${payload.data.fullName}` : ""}.\n\nPlease sign in again with your new password.`,
          moveTo: "/login",
        });
        return;
      }

      showPopup({
        type: "error",
        message: "Unable to activate your account. Please try again.",
      });
    } catch (error) {
      console.error("Password change error:", error);
      const fallbackDetail = buildDiagnosticPresentation(
        {
          status: 0,
          url: toAuthApiUrl("/password/first-login/change"),
          message: buildDisplayMessage(
            { status: 0, url: toAuthApiUrl("/password/first-login/change") },
            "Unable to reach the authentication service. Please try again.",
          ),
        },
        "Unable to reach the authentication service. Please try again.",
      );
      showPopup({
        type: "error",
        message: fallbackDetail.message,
        diagnostic: fallbackDetail.diagnostic,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.18),_transparent_32%),linear-gradient(135deg,#f8fafc_0%,#eef7ff_45%,#f7fbff_100%)] px-4 py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-56 w-56 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute right-[-6rem] top-16 h-52 w-52 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-64 w-64 rounded-full bg-amber-200/25 blur-3xl" />
      </div>

      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center"
      >
        <div className="grid w-full gap-4 lg:grid-cols-[1.06fr_0.94fr]">
          <section className="hidden rounded-[2rem] border border-white/70 bg-white/60 px-6 pb-10 pt-6 shadow-[0_30px_80px_-38px_rgba(15,23,42,0.45)] backdrop-blur-xl lg:flex lg:min-h-full lg:flex-col lg:justify-between">
            <div>
              <div className="mb-4 flex items-center gap-4">
                <img src={logo} alt="HARTRON Logo" width={92} height={48} />
                <img
                  src={govt}
                  alt="Government Logo"
                  width={220}
                  height={120}
                />
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                <ShieldCheck className="h-4 w-4" />
                Account Activation
              </div>
              <h1 className="mt-3.5 max-w-xl text-[2.05rem] font-semibold leading-tight text-slate-900">
                Secure your HARTRON Store account before your first session
                begins.
              </h1>
              <p className="mt-2.5 max-w-xl text-[15px] leading-6 text-slate-600">
                We’ve recognized that you are signing in with a temporary
                provisioning password. Set a private password once, and we’ll
                activate the account immediately.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white/80 p-3.5">
                <div>
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <LockKeyhole className="h-5 w-5" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    No default password usage
                  </h2>
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  The temporary password only gets you to this activation step.
                  It will never become your usable application password.
                </p>
              </div>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white/80 p-3.5">
                <div>
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Session unlock after change
                  </h2>
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  Once your new password is saved, your account is activated and
                  you’ll be ready to sign in with your private password.
                </p>
              </div>
            </div>
          </section>

          <Card className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 shadow-[0_34px_90px_-42px_rgba(15,23,42,0.5)] backdrop-blur-xl">
            <CardContent className="p-0">
              <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 px-6 py-4 text-white sm:px-8">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
                      First Login Password Change
                    </p>
                    <h2 className="mt-1.5 text-[1.7rem] font-semibold leading-tight">
                      {context?.fullName
                        ? `Activate ${context.fullName}`
                        : "Activate Your Account"}
                    </h2>
                    <p className="mt-1.5 max-w-lg text-sm leading-5 text-slate-200/90">
                      Choose a strong password that only you know. We’ll use it
                      for your future sign-ins.
                    </p>
                  </div>
                  <a
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                  </a>
                </div>
              </div>

              <div className="space-y-4 px-6 py-5 sm:px-8">
                {!hasToken ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
                    <p className="font-semibold">
                      No active password activation session found.
                    </p>
                    <p className="mt-2">
                      Sign in again with your temporary password to receive a
                      fresh password change session.
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      New password
                    </label>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Enter a strong new password"
                        className="h-12 rounded-xl border-slate-300 pr-12"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowNewPassword((current) => !current)
                        }
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
                      Confirm password
                    </label>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter your new password"
                        className="h-12 rounded-xl border-slate-300 pr-12"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-3.5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-slate-700" />
                    <p className="text-sm font-semibold text-slate-900">
                      Password requirements
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ruleStates.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 text-[12.5px] leading-[1.05rem] text-slate-700 shadow-sm"
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
                    <div className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 text-[12.5px] leading-[1.05rem] text-slate-700 shadow-sm">
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                        {passwordsMatch ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-500" />
                        )}
                      </span>
                      <span>New password and confirm password match</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 text-[12.5px] leading-[1.05rem] text-slate-700 shadow-sm">
                      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                        {differsFromTemporaryPassword ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-500" />
                        )}
                      </span>
                      <span>
                        Must be different from your temporary password
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || !canSubmit}
                  className="h-12 w-full rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {loading
                    ? "Securing account..."
                    : "Save New Password And Continue"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Motion.div>

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
