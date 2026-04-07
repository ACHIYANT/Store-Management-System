import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  XCircle,
} from "lucide-react";

import PopupMessage from "@/components/PopupMessage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toStoreApiUrl } from "@/lib/api-config";
import { getPasswordRuleStates } from "@/lib/password-policy";
import {
  buildDiagnosticPresentation,
  buildDisplayMessage,
} from "@/lib/network";

import logo from "/logo.svg";
import govt from "/govt.svg";

const PROVISIONING_PASSWORD = String(
  import.meta.env.VITE_EMPLOYEE_PROVISION_DEFAULT_PASSWORD || "",
).trim();

const normalizeMobile = (value = "") =>
  String(value || "")
    .replace(/\D/g, "")
    .trim();

const parseApiFeedback = async (response, url, fallbackMessage) => {
  try {
    const payload = await response.clone().json();
    return buildDiagnosticPresentation(
      {
        status: Number(response?.status || 0),
        url,
        code: payload?.code || payload?.err?.code,
        message:
          payload?.message || payload?.err?.message || payload?.data?.message,
        hint: payload?.hint,
        requestId: payload?.requestId || response.headers.get("x-request-id"),
        details: payload?.details,
      },
      fallbackMessage,
    );
  } catch {
    try {
      const text = await response.text();
      return {
        message: text || fallbackMessage,
        diagnostic: null,
        detail: null,
      };
    } catch {
      return {
        message: fallbackMessage,
        diagnostic: null,
        detail: null,
      };
    }
  }
};

const formatLabel = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "Not available";
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export default function ActivateAccount() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [verifiedEmployee, setVerifiedEmployee] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [activating, setActivating] = useState(false);
  const [popup, setPopup] = useState({
    open: false,
    type: "info",
    message: "",
    moveTo: "",
    diagnostic: null,
  });

  const verifyUrl = toStoreApiUrl("/account-activation/validate");
  const executeUrl = toStoreApiUrl("/account-activation/execute");

  const ruleStates = useMemo(
    () => getPasswordRuleStates(newPassword),
    [newPassword],
  );
  const passwordsMatch =
    Boolean(confirmPassword) && String(newPassword) === String(confirmPassword);
  const differsFromProvisioningPassword =
    !PROVISIONING_PASSWORD ||
    (Boolean(newPassword) && String(newPassword) !== PROVISIONING_PASSWORD);
  const canActivate =
    Boolean(verifiedEmployee) &&
    Boolean(newPassword) &&
    Boolean(confirmPassword) &&
    passwordsMatch &&
    differsFromProvisioningPassword &&
    ruleStates.every((rule) => rule.passed);

  const showPopup = ({
    type = "info",
    message = "",
    moveTo = "",
    diagnostic = null,
  }) => {
    setPopup({ open: true, type, message, moveTo, diagnostic });
  };

  const resetVerificationState = () => {
    setVerifiedEmployee(null);
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleVerify = async () => {
    const normalizedEmployeeCode = String(employeeCode || "").trim();
    const normalizedMobile = normalizeMobile(mobileNumber);

    if (!normalizedEmployeeCode || !normalizedMobile) {
      showPopup({
        type: "warning",
        message:
          "Enter both employee code and registered mobile number to continue.",
      });
      return;
    }

    setVerifying(true);
    resetVerificationState();

    try {
      const response = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          empcode: normalizedEmployeeCode,
          mobileno: normalizedMobile,
        }),
      });

      if (!response.ok) {
        const feedback = await parseApiFeedback(
          response,
          verifyUrl,
          "Unable to verify your employee details. Please try again.",
        );
        showPopup({
          type: "error",
          message: feedback.message,
          diagnostic: feedback.diagnostic,
        });
        return;
      }

      const payload = await response.json();
      const result = payload?.data || {};

      if (!result?.eligible) {
        const activationState = String(result?.activation_state || "").trim();
        const message =
          activationState === "provisioned"
            ? "A Store access account already exists for this employee and is awaiting first sign-in activation.\n\nPlease sign in with the credentials issued to you, or contact the database admin if you need help."
            : "A Store access account is already active for this employee.\n\nPlease return to the login page and sign in with your existing credentials.";

        showPopup({
          type: "info",
          message,
          moveTo: "/login",
        });
        return;
      }

      setVerifiedEmployee(result?.employee || null);
    } catch (error) {
      console.error("Activation validation error:", error);
      const fallbackDetail = buildDiagnosticPresentation(
        {
          status: 0,
          url: verifyUrl,
          message: buildDisplayMessage(
            { status: 0, url: verifyUrl },
            "Unable to reach the Store service. Please try again.",
          ),
        },
        "Unable to reach the Store service. Please try again.",
      );
      showPopup({
        type: "error",
        message: fallbackDetail.message,
        diagnostic: fallbackDetail.diagnostic,
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleActivate = async () => {
    if (!canActivate) {
      showPopup({
        type: "warning",
        message:
          "Complete the employee verification and password requirements before continuing.",
      });
      return;
    }

    setActivating(true);

    try {
      const response = await fetch(executeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          empcode: String(employeeCode || "").trim(),
          mobileno: normalizeMobile(mobileNumber),
          newPassword,
          confirmPassword,
        }),
      });

      if (!response.ok) {
        const feedback = await parseApiFeedback(
          response,
          executeUrl,
          "Unable to activate your account. Please review the details and try again.",
        );
        showPopup({
          type: "error",
          message: feedback.message,
          diagnostic: feedback.diagnostic,
        });
        return;
      }

      const payload = await response.json();
      if (payload?.success) {
        resetVerificationState();
        setEmployeeCode("");
        setMobileNumber("");
        showPopup({
          type: "success",
          message:
            "Account activated successfully.\n\nPlease sign in with your mobile number and new password.",
          moveTo: "/login",
        });
        return;
      }

      showPopup({
        type: "error",
        message: "Unable to activate your account. Please try again.",
      });
    } catch (error) {
      console.error("Activation execute error:", error);
      const fallbackDetail = buildDiagnosticPresentation(
        {
          status: 0,
          url: executeUrl,
          message: buildDisplayMessage(
            { status: 0, url: executeUrl },
            "Unable to reach the Store service. Please try again.",
          ),
        },
        "Unable to reach the Store service. Please try again.",
      );
      showPopup({
        type: "error",
        message: fallbackDetail.message,
        diagnostic: fallbackDetail.diagnostic,
      });
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.2),_transparent_30%),linear-gradient(135deg,#f8fafc_0%,#eef7ff_45%,#f8fbff_100%)] px-4 py-4 lg:py-3">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-7rem] top-[-5rem] h-52 w-52 rounded-full bg-cyan-200/35 blur-3xl" />
        <div className="absolute right-[-7rem] top-20 h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/3 h-72 w-72 rounded-full bg-amber-200/25 blur-3xl" />
      </div>

      <Motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl items-center justify-center"
      >
        <div className="grid w-full gap-3 lg:grid-cols-[1fr_0.96fr]">
          <section className="hidden rounded-[2rem] border border-white/70 bg-white/60 px-5 pb-5 pt-5 shadow-[0_30px_80px_-38px_rgba(15,23,42,0.45)] backdrop-blur-xl lg:flex lg:flex-col lg:justify-start lg:gap-5">
            <div>
              <div className="mb-3 flex items-center gap-4">
                <img src={logo} alt="HARTRON Logo" width={88} height={46} />
                <img
                  src={govt}
                  alt="Government Logo"
                  width={204}
                  height={108}
                />
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                <ShieldCheck className="h-4 w-4" />
                Employee Account Activation
              </div>
              <h1 className="mt-2.5 max-w-xl text-[1.8rem] font-semibold leading-tight text-slate-900">
                Claim your HARTRON Store access using your employee record.
              </h1>
              <p className="mt-1.5 max-w-xl text-[13.5px] leading-5.5 text-slate-600">
                We verify your employee code and registered mobile number
                against the Store employee master, then create your sign-in
                access from trusted data already held by the system.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-3.5 shadow-sm lg:mt-6">
              <div className="mb-2.5 flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-slate-700" />
                <p className="text-sm font-semibold text-slate-900">
                  How activation works
                </p>
              </div>
              <div className="grid gap-2">
                <div className="grid grid-cols-[1.9rem_1fr] items-start gap-3 rounded-xl bg-slate-50/85 px-3 py-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                    1
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">
                      Verify your employee record
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-5 text-slate-600">
                      Match your employee code with the mobile number already
                      saved in the Store employee master.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-[1.9rem_1fr] items-start gap-3 rounded-xl bg-slate-50/85 px-3 py-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cyan-600 text-[11px] font-semibold text-white">
                    2
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">
                      Review the trusted account details
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-5 text-slate-600">
                      Your name, designation, division, and location are pulled
                      from the official employee record, not from public input.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-[1.9rem_1fr] items-start gap-3 rounded-xl bg-slate-50/85 px-3 py-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white">
                    3
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-slate-900">
                      Set your password and return to login
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-5 text-slate-600">
                      Choose your private sign-in password once, then continue
                      from the normal login screen with the new credential.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:mt-6">
              <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white/80 p-3">
                <div>
                  <div className="mb-1.5 inline-flex h-8.5 w-8.5 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Fingerprint className="h-4.5 w-4.5" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Employee master verification
                  </h2>
                </div>
                <p className="mt-1 text-[13px] leading-5 text-slate-600">
                  Your employee code and registered mobile number are checked
                  first. You do not need to type name, designation, or division
                  manually.
                </p>
              </div>
              <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white/80 p-3">
                <div>
                  <div className="mb-1.5 inline-flex h-8.5 w-8.5 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                    <KeyRound className="h-4.5 w-4.5" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Private password from day one
                  </h2>
                </div>
                <p className="mt-1 text-[13px] leading-5 text-slate-600">
                  Once verification succeeds, you choose your own password
                  immediately and then return to login with a normal private
                  credential.
                </p>
              </div>
            </div>
          </section>

          <Card className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 shadow-[0_34px_90px_-42px_rgba(15,23,42,0.5)] backdrop-blur-xl">
            <CardContent className="p-0 lg:flex lg:flex-col">
              <div className="border-b border-slate-200/80 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950 px-6 py-3.5 text-white sm:px-7">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
                      Public Activation Flow
                    </p>
                    <h2 className="mt-1 text-[1.55rem] font-semibold leading-tight">
                      Activate Your Account
                    </h2>
                    <p className="mt-1 max-w-lg text-[13px] leading-5 text-slate-200/90">
                      First verify your employee identity, then set the password
                      you will use for future sign-ins.
                    </p>
                  </div>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Login
                  </Link>
                </div>
              </div>

              <div className="space-y-3.5 px-6 py-4 sm:px-7">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-slate-700" />
                    <p className="text-sm font-semibold text-slate-900">
                      Step 1. Verify employee details
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        Employee code
                      </label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Enter employee code"
                        className="h-11 rounded-xl border-slate-300"
                        value={employeeCode}
                        onChange={(event) => {
                          setEmployeeCode(event.target.value);
                          if (verifiedEmployee) resetVerificationState();
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">
                        Registered mobile number
                      </label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Enter registered mobile number"
                        className="h-11 rounded-xl border-slate-300"
                        value={mobileNumber}
                        onChange={(event) => {
                          setMobileNumber(event.target.value);
                          if (verifiedEmployee) resetVerificationState();
                        }}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      onClick={handleVerify}
                      disabled={verifying}
                      className="h-10.5 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying employee...
                        </>
                      ) : (
                        "Verify Employee"
                      )}
                    </Button>
                    {verifiedEmployee ? (
                      <button
                        type="button"
                        onClick={resetVerificationState}
                        className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
                      >
                        Clear verified state
                      </button>
                    ) : null}
                  </div>
                </div>

                {verifiedEmployee ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      <p className="text-sm font-semibold text-emerald-950">
                        Employee verified successfully
                      </p>
                    </div>
                    <div className="grid gap-2 rounded-xl bg-white/90 p-2.5 shadow-sm lg:grid-cols-[1.1fr_0.9fr_0.8fr]">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Employee
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 truncate text-sm font-semibold text-slate-900">
                          <UserRound className="h-4 w-4 shrink-0 text-slate-500" />
                          <span className="truncate">
                            {verifiedEmployee?.name || "Not available"}
                          </span>
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Role context
                        </p>
                        <p className="mt-0.5 truncate text-sm text-slate-700">
                          {formatLabel(verifiedEmployee?.designation)} ·{" "}
                          {formatLabel(verifiedEmployee?.division)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Location
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 truncate text-sm text-slate-700">
                          <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
                          <span className="truncate">
                            {formatLabel(verifiedEmployee?.office_location)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-3.5">
                  <div className="mb-2.5 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-slate-700" />
                    <p className="text-sm font-semibold text-slate-900">
                      Step 2. Set your sign-in password
                    </p>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[0.98fr_1.02fr] lg:items-start">
                    <div className="grid gap-2.5">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                          New password
                        </label>
                        <div className="relative">
                          <Input
                            type={showNewPassword ? "text" : "password"}
                            placeholder="Enter your new password"
                            className="h-10.5 rounded-xl border-slate-300 pr-12"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            disabled={!verifiedEmployee}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowNewPassword((current) => !current)
                            }
                            className="absolute inset-y-0 right-0 inline-flex items-center px-4 text-slate-500 transition hover:text-slate-700"
                            disabled={!verifiedEmployee}
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
                            className="h-10.5 rounded-xl border-slate-300 pr-12"
                            value={confirmPassword}
                            onChange={(event) =>
                              setConfirmPassword(event.target.value)
                            }
                            disabled={!verifiedEmployee}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword((current) => !current)
                            }
                            className="absolute inset-y-0 right-0 inline-flex items-center px-4 text-slate-500 transition hover:text-slate-700"
                            disabled={!verifiedEmployee}
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

                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-slate-700" />
                        <p className="text-sm font-semibold text-slate-900">
                          Password requirements
                        </p>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                        {ruleStates.map((rule) => (
                          <div
                            key={rule.id}
                            className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5 text-[12px] leading-[1rem] text-slate-700"
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
                        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5 text-[12px] leading-[1rem] text-slate-700">
                          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                            {passwordsMatch ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-rose-500" />
                            )}
                          </span>
                          <span>New password and confirm password match</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5 text-[12px] leading-[1rem] text-slate-700">
                          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                            {differsFromProvisioningPassword ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-rose-500" />
                            )}
                          </span>
                          <span>
                            Must be different from the shared provisioning
                            password
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating || !canActivate}
                  className="h-11 w-full rounded-xl bg-cyan-600 text-sm font-semibold text-white transition hover:bg-cyan-700"
                >
                  {activating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Activating account...
                    </>
                  ) : (
                    "Activate Account And Return To Login"
                  )}
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
