"use strict";

const {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  parseCookies,
} = require("../utils/cookie-utils");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function normalizePath(pathValue) {
  const raw = String(pathValue || "").trim();
  if (!raw) return "";
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function shouldSkipPath(pathValue, skipPaths = []) {
  const current = normalizePath(pathValue);
  if (!current) return false;
  return skipPaths.some((entry) => normalizePath(entry) === current);
}

function csrfProtection(options = {}) {
  const headerName = String(process.env.CSRF_HEADER_NAME || "x-csrf-token")
    .trim()
    .toLowerCase();
  const enabled =
    String(process.env.CSRF_PROTECTION_ENABLED || "true").toLowerCase() !==
    "false";
  const skipPaths = Array.isArray(options.skipPaths) ? options.skipPaths : [];

  return (req, res, next) => {
    if (!enabled) return next();
    if (SAFE_METHODS.has(String(req.method || "").toUpperCase())) return next();

    if (shouldSkipPath(req.path, skipPaths)) return next();

    const cookies = parseCookies(req.headers.cookie);
    const authCookieValue = cookies[AUTH_COOKIE_NAME];
    if (!authCookieValue) return next();

    const csrfCookieValue = cookies[CSRF_COOKIE_NAME];
    const csrfHeaderValue = String(req.headers[headerName] || "").trim();

    if (
      !csrfCookieValue ||
      !csrfHeaderValue ||
      csrfCookieValue !== csrfHeaderValue
    ) {
      return res.status(403).json({
        success: false,
        message: "CSRF validation failed",
        data: {},
        err: {
          code: "CSRF_MISMATCH",
          message: "Request rejected due to invalid CSRF token.",
        },
      });
    }

    return next();
  };
}

module.exports = {
  csrfProtection,
};
