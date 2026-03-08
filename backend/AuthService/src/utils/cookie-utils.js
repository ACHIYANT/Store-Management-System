"use strict";

const crypto = require("crypto");

const AUTH_COOKIE_NAME = String(process.env.AUTH_COOKIE_NAME || "token").trim() || "token";
const CSRF_COOKIE_NAME =
  String(process.env.CSRF_COOKIE_NAME || "csrf_token").trim() || "csrf_token";

const getNodeEnv = () => String(process.env.NODE_ENV || "").toLowerCase();
const isProduction = () => getNodeEnv() === "production";

const normalizeSameSite = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "strict") return "Strict";
  if (raw === "none") return "None";
  return "Lax";
};

const COOKIE_SAME_SITE = normalizeSameSite(process.env.COOKIE_SAME_SITE);
const COOKIE_SECURE =
  String(process.env.COOKIE_SECURE || "").toLowerCase() === "true" ||
  isProduction();
const COOKIE_DOMAIN = String(process.env.COOKIE_DOMAIN || "").trim() || undefined;
const COOKIE_PATH = String(process.env.COOKIE_PATH || "/").trim() || "/";
const AUTH_COOKIE_MAX_AGE_MS = Number(process.env.AUTH_COOKIE_MAX_AGE_MS || 24 * 60 * 60 * 1000);
const CSRF_COOKIE_MAX_AGE_MS = Number(process.env.CSRF_COOKIE_MAX_AGE_MS || AUTH_COOKIE_MAX_AGE_MS);

function parseCookies(cookieHeader = "") {
  return String(cookieHeader || "")
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((acc, chunk) => {
      const idx = chunk.indexOf("=");
      if (idx <= 0) return acc;
      const key = chunk.slice(0, idx).trim();
      const value = chunk.slice(idx + 1);
      if (!key) return acc;
      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        acc[key] = value;
      }
      return acc;
    }, {});
}

function buildCookieOptions({
  httpOnly,
  maxAge,
}) {
  const options = {
    httpOnly: Boolean(httpOnly),
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAME_SITE,
    path: COOKIE_PATH,
    maxAge: Number.isFinite(Number(maxAge)) ? Number(maxAge) : undefined,
  };
  if (COOKIE_DOMAIN) options.domain = COOKIE_DOMAIN;
  return options;
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

function setSessionCookies(res, jwtToken, csrfToken) {
  if (!jwtToken) return;
  res.cookie(
    AUTH_COOKIE_NAME,
    jwtToken,
    buildCookieOptions({
      httpOnly: true,
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
    }),
  );

  res.cookie(
    CSRF_COOKIE_NAME,
    csrfToken || generateCsrfToken(),
    buildCookieOptions({
      httpOnly: false,
      maxAge: CSRF_COOKIE_MAX_AGE_MS,
    }),
  );
}

function clearSessionCookies(res) {
  res.clearCookie(
    AUTH_COOKIE_NAME,
    buildCookieOptions({
      httpOnly: true,
      maxAge: 0,
    }),
  );
  res.clearCookie(
    CSRF_COOKIE_NAME,
    buildCookieOptions({
      httpOnly: false,
      maxAge: 0,
    }),
  );
}

module.exports = {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  buildCookieOptions,
  clearSessionCookies,
  generateCsrfToken,
  parseCookies,
  setSessionCookies,
};

