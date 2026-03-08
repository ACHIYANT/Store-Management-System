"use strict";

const AUTH_COOKIE_NAME = String(process.env.AUTH_COOKIE_NAME || "token").trim() || "token";
const CSRF_COOKIE_NAME =
  String(process.env.CSRF_COOKIE_NAME || "csrf_token").trim() || "csrf_token";

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

module.exports = {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  parseCookies,
};

