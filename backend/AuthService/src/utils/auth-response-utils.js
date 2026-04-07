"use strict";

const DEFAULT_ERROR_HINTS = {
  TOKEN_MISSING: "Please log in again to continue.",
  COOKIE_MISSING:
    "Please log in again. If the issue continues, check whether your browser is blocking cookies.",
  SESSION_EXPIRED: "Please log in again.",
  TOKEN_INVALID: "Please log in again.",
  TOKEN_NOT_ACTIVE: "Please wait a moment and try again.",
  SESSION_REVOKED: "Please log in again.",
  USER_NOT_FOUND: "Please contact a super admin if the issue continues.",
  AUTH_SERVICE_TIMEOUT: "Please try again in a moment.",
  AUTH_SERVICE_UNREACHABLE: "Please try again in a moment.",
  ROLE_FORBIDDEN: "Please use an account with the required role.",
  LOCATION_SCOPE_MISSING:
    "Please ask a super admin to assign a location to your account.",
  PASSWORD_CHANGE_REQUIRED:
    "Change your password before continuing.",
  PASSWORD_CHANGE_TOKEN_INVALID:
    "Start the sign-in process again to get a fresh password change link.",
  PASSWORD_CHANGE_TOKEN_EXPIRED:
    "Start the sign-in process again to continue.",
  CURRENT_PASSWORD_INCORRECT: "Please enter your current password correctly.",
  PASSWORD_CONFIRMATION_MISMATCH:
    "Enter the same new password in both fields.",
  PASSWORD_REUSE_FORBIDDEN:
    "Choose a new password that is different from your current or default password.",
  PUBLIC_SIGNUP_DISABLED:
    "Use the activate account flow to claim access with your employee details.",
  STORE_EMPLOYEE_VERIFICATION_FAILED:
    "Please contact the administrator to complete employee onboarding.",
  STORE_VERIFICATION_TIMEOUT: "Please try again in a moment.",
  STORE_VERIFICATION_UNREACHABLE: "Please try again in a moment.",
  ACCOUNT_ALREADY_EXISTS:
    "Please sign in with your existing credentials or contact the administrator.",
  CSRF_MISMATCH: "Refresh the page and try again.",
  INTERNAL_SERVER_ERROR: "Please try again in a moment.",
};

const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || "";
};

const normalizeDetails = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
};

const getRequestId = (req, res) =>
  normalizeText(res?.getHeader?.("x-request-id")) ||
  normalizeText(req?.requestId) ||
  null;

const buildErrorPayload = (req, res, error = {}, fallback = {}) => {
  const statusCode = Number(error?.statusCode || fallback?.statusCode || 500);
  const code = normalizeText(error?.code || fallback?.code) || "INTERNAL_SERVER_ERROR";
  const message =
    normalizeText(error?.message || fallback?.message) ||
    (statusCode >= 500 ? "Something went wrong on our side." : "Request failed.");
  const hint =
    normalizeText(error?.hint || error?.explanation || fallback?.hint) ||
    DEFAULT_ERROR_HINTS[code] ||
    "";
  const details = normalizeDetails(error?.details || fallback?.details);
  const requestId = getRequestId(req, res);
  const responseData =
    error?.data && typeof error.data === "object" && !Array.isArray(error.data)
      ? error.data
      : fallback?.data && typeof fallback.data === "object" && !Array.isArray(fallback.data)
        ? fallback.data
        : {};

  return {
    success: false,
    statusCode,
    code,
    message,
    hint,
    requestId,
    data: responseData,
    details: details.length ? details : undefined,
    err: {
      code,
      message,
    },
  };
};

const sendError = (req, res, error = {}, fallback = {}) => {
  const payload = buildErrorPayload(req, res, error, fallback);
  return res.status(payload.statusCode).json(payload);
};

const buildSuccessPayload = (req, res, data = {}, options = {}) => ({
  success: true,
  statusCode: Number(options.statusCode || 200),
  message: normalizeText(options.message) || "Request completed successfully.",
  data,
  requestId: getRequestId(req, res),
  err: {},
});

const toIsoString = (unixSeconds) => {
  const seconds = Number(unixSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
};

const buildSessionSnapshot = (tokenPayload = {}, options = {}) => {
  const issuedAtSeconds = Number(tokenPayload?.iat);
  const expiresAtSeconds = Number(tokenPayload?.exp);
  const nowSeconds = Math.floor(Date.now() / 1000);

  return {
    auth_mode: normalizeText(options.authMode) || "cookie",
    token_source: normalizeText(options.tokenSource) || null,
    issued_at: toIsoString(issuedAtSeconds),
    expires_at: toIsoString(expiresAtSeconds),
    expires_in_seconds:
      Number.isFinite(expiresAtSeconds) && expiresAtSeconds > 0
        ? Math.max(0, expiresAtSeconds - nowSeconds)
        : null,
    server_time: new Date().toISOString(),
  };
};

module.exports = {
  buildErrorPayload,
  buildSessionSnapshot,
  buildSuccessPayload,
  sendError,
};
