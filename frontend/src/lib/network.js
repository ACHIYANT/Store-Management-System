import axios from "axios";
import { AUTH_API_BASE_URL, STORE_API_BASE_URL } from "./api-config";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const LAST_API_DIAGNOSTIC_KEY = "sms:last-api-diagnostic";
const DEBUG_DIAGNOSTIC_STORAGE_KEY = "sms_debug_diagnostics";
let forcedLogoutInProgress = false;

function isLoopbackHost(hostname = "") {
  return LOOPBACK_HOSTS.has(String(hostname).toLowerCase());
}

const API_V1_PREFIX = "/api/v1";

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

function parseCookieValue(rawCookie = "") {
  return String(rawCookie || "")
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

function getCookie(name) {
  if (typeof window === "undefined") return "";
  const cookieMap = parseCookieValue(window.document.cookie || "");
  return String(cookieMap[name] || "").trim();
}

function getCsrfToken() {
  const csrfCookieName = import.meta.env.VITE_CSRF_COOKIE_NAME || "csrf_token";
  return getCookie(csrfCookieName);
}

function isMutatingMethod(method = "GET") {
  const normalized = String(method || "GET").toUpperCase();
  return ["POST", "PUT", "PATCH", "DELETE"].includes(normalized);
}

function inferServiceLabel(url = "") {
  const normalizedUrl = String(url || "");
  if (!normalizedUrl) return "service";
  if (
    normalizedUrl.includes(AUTH_API_BASE_URL) ||
    normalizedUrl.includes("/api/auth") ||
    normalizedUrl.includes(":3001/")
  ) {
    return "authentication service";
  }
  if (
    normalizedUrl.includes(STORE_API_BASE_URL) ||
    normalizedUrl.includes("/api/store") ||
    normalizedUrl.includes(":3000/")
  ) {
    return "store service";
  }
  return "service";
}

function getFallbackMessage(status = 0, url = "") {
  if (status === 401) return "Unauthorized. Please login again.";
  if (status === 403) return "You are not allowed to perform this action.";
  if (!status) return `Could not reach the ${inferServiceLabel(url)}.`;
  if (status >= 500) return "Something went wrong on our side.";
  return "Request failed.";
}

function normalizeApiErrorDetail(detail = {}) {
  const status = Number(detail?.status || detail?.statusCode || 0);
  const url = normalizeText(detail?.url);
  const code = normalizeText(detail?.code || detail?.err?.code);
  const hint = normalizeText(detail?.hint || detail?.err?.hint);
  const requestId = normalizeText(detail?.requestId);
  const upstreamRequestId = normalizeText(detail?.upstreamRequestId);
  const details = normalizeDetails(detail?.details);
  const message =
    normalizeText(detail?.message || detail?.err?.message) ||
    getFallbackMessage(status, url);

  return {
    status,
    code,
    message,
    hint,
    requestId,
    upstreamRequestId,
    details,
    url,
    service: inferServiceLabel(url),
    forceLogout: Boolean(detail?.forceLogout),
    redirectTo: normalizeText(detail?.redirectTo) || "/login",
    allowDiagnostics: Boolean(detail?.allowDiagnostics),
    debugDiagnostics: Boolean(detail?.debugDiagnostics),
    capturedAt: normalizeText(detail?.capturedAt) || new Date().toISOString(),
  };
}

function getStoredRoles() {
  if (typeof window === "undefined") return [];
  const normalizedRoles = new Set();

  try {
    const rawRoles = JSON.parse(localStorage.getItem("roles") || "[]");
    if (Array.isArray(rawRoles)) {
      rawRoles.forEach((role) => {
        const text = normalizeText(role).toUpperCase();
        if (text) normalizedRoles.add(text);
      });
    }
  } catch {
    // ignore malformed roles cache
  }

  try {
    const me = JSON.parse(localStorage.getItem("me") || "null");
    if (Array.isArray(me?.roles)) {
      me.roles.forEach((role) => {
        const text = normalizeText(role).toUpperCase();
        if (text) normalizedRoles.add(text);
      });
    }
  } catch {
    // ignore malformed me cache
  }

  return [...normalizedRoles];
}

function isSuperAdminViewer() {
  return getStoredRoles().includes("SUPER_ADMIN");
}

function isDebugDiagnosticsMode() {
  if (typeof window === "undefined") {
    return String(import.meta.env.VITE_ENABLE_DEBUG_DIAGNOSTICS || "false").toLowerCase() === "true";
  }

  return (
    String(import.meta.env.VITE_ENABLE_DEBUG_DIAGNOSTICS || "false").toLowerCase() === "true" ||
    String(window.localStorage.getItem(DEBUG_DIAGNOSTIC_STORAGE_KEY) || "false").toLowerCase() === "true"
  );
}

export function buildDisplayMessage(detailOrMessage, fallbackMessage = "Request failed.") {
  if (typeof detailOrMessage === "string") {
    return normalizeText(detailOrMessage) || fallbackMessage;
  }

  const detail = normalizeApiErrorDetail(detailOrMessage);
  const lines = [detail.message || fallbackMessage];

  if (detail.hint) {
    lines.push(detail.hint);
  }
  if (detail.requestId) {
    lines.push(`Reference ID: ${detail.requestId}`);
  }

  return lines.join("\n\n");
}

export function buildDiagnosticPresentation(detailOrMessage, fallbackMessage = "Request failed.") {
  const detail =
    typeof detailOrMessage === "string"
      ? normalizeApiErrorDetail({ message: detailOrMessage })
      : normalizeApiErrorDetail(detailOrMessage);
  const debugDiagnosticsEnabled = Boolean(detail?.debugDiagnostics) || isDebugDiagnosticsMode();
  const showDiagnostics = Boolean(detail?.allowDiagnostics) || isSuperAdminViewer() || debugDiagnosticsEnabled;
  const rows = [];

  if (detail.code) rows.push({ label: "Code", value: detail.code });
  if (detail.status) rows.push({ label: "Status", value: String(detail.status) });
  if (detail.service) rows.push({ label: "Service", value: detail.service });
  if (detail.requestId) rows.push({ label: "Request ID", value: detail.requestId });
  if (detail.upstreamRequestId && detail.upstreamRequestId !== detail.requestId) {
    rows.push({ label: "Upstream Request ID", value: detail.upstreamRequestId });
  }
  if (detail.capturedAt) rows.push({ label: "Captured At", value: detail.capturedAt });
  if (detail.url && isDebugDiagnosticsMode()) rows.push({ label: "Endpoint", value: detail.url });
  detail.details.forEach((entry, index) => {
    rows.push({ label: `Detail ${index + 1}`, value: entry });
  });

  return {
    message: buildDisplayMessage(detail, fallbackMessage),
    diagnostic:
      showDiagnostics && rows.length
        ? {
            title: debugDiagnosticsEnabled ? "Diagnostics" : "Admin Diagnostics",
            rows,
            defaultExpanded: false,
          }
        : null,
    detail,
  };
}

function storeLastApiDiagnostic(detail) {
  if (typeof window === "undefined") return;
  const normalized = normalizeApiErrorDetail(detail);
  const payload = {
    ...normalized,
    userMessage: buildDisplayMessage(normalized, normalized.message),
  };

  try {
    window.sessionStorage.setItem(LAST_API_DIAGNOSTIC_KEY, JSON.stringify(payload));
  } catch {
    // ignore browser storage failures
  }

  window.__smsLastApiDiagnostic = payload;
}

export function getLastApiDiagnostic() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LAST_API_DIAGNOSTIC_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function emitApiError(detail) {
  if (typeof window === "undefined") return;
  const normalized = normalizeApiErrorDetail(detail);
  const presentation = buildDiagnosticPresentation(normalized, normalized.message);
  const eventDetail = {
    ...normalized,
    message: presentation.message,
    diagnostic: presentation.diagnostic,
  };

  storeLastApiDiagnostic(normalized);

  window.dispatchEvent(
    new CustomEvent("sms:api-error", {
      detail: eventDetail,
    }),
  );
}

function clearClientSessionData() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("fullname");
    localStorage.removeItem("roles");
    localStorage.removeItem("me");
  } catch {
    // ignore client storage failures
  }
}

function triggerForcedLogout(detailOrMessage = "Unauthorized. Please login again.") {
  if (typeof window === "undefined") return;
  if (forcedLogoutInProgress) return;

  forcedLogoutInProgress = true;
  const allowDiagnostics = isSuperAdminViewer();
  const debugDiagnostics = isDebugDiagnosticsMode();
  const normalized =
    typeof detailOrMessage === "string"
      ? normalizeApiErrorDetail({
          status: 401,
          message: detailOrMessage,
          forceLogout: true,
          redirectTo: "/login",
        })
      : normalizeApiErrorDetail({
          ...detailOrMessage,
          status: Number(detailOrMessage?.status || 401),
          forceLogout: true,
          redirectTo: normalizeText(detailOrMessage?.redirectTo) || "/login",
        });

  clearClientSessionData();
  emitApiError({
    ...normalized,
    allowDiagnostics,
    debugDiagnostics,
  });

  setTimeout(() => {
    forcedLogoutInProgress = false;
  }, 5000);
}

function buildPayloadErrorDetail(payload = {}, options = {}) {
  return normalizeApiErrorDetail({
    status: Number(options?.status || 0),
    url: options?.url,
    code: payload?.code || payload?.err?.code,
    message: payload?.message || payload?.err?.message || payload?.error,
    hint: payload?.hint,
    requestId: payload?.requestId || options?.requestId,
    upstreamRequestId: payload?.upstreamRequestId,
    details: payload?.details,
  });
}

async function parseResponsePayload(response) {
  if (!response) return null;
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

async function buildFetchResponseDetail(response, url) {
  const payload = (await parseResponsePayload(response)) || {};
  return buildPayloadErrorDetail(payload, {
    status: Number(response?.status || 0),
    requestId: normalizeText(response?.headers?.get("x-request-id")),
    url,
  });
}

function buildAxiosErrorDetail(error) {
  const payload = error?.response?.data || {};
  const headers = error?.response?.headers || {};
  return buildPayloadErrorDetail(payload, {
    status: Number(error?.response?.status || 0),
    requestId: normalizeText(headers["x-request-id"]),
    url: String(error?.config?.url || ""),
  });
}

export function rewriteLocalApiUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== "string") return inputUrl;

  let parsed;
  try {
    parsed = new URL(inputUrl, window.location.origin);
  } catch {
    return inputUrl;
  }

  if (!isLoopbackHost(parsed.hostname)) {
    return inputUrl;
  }

  const resolvedPort = String(parsed.port || "");
  if (resolvedPort === "3000") {
    return rewriteToApiBase(parsed, STORE_API_BASE_URL);
  }
  if (resolvedPort === "3001") {
    return rewriteToApiBase(parsed, AUTH_API_BASE_URL);
  }

  return inputUrl;
}

function rewriteToApiBase(parsedUrl, targetBase) {
  try {
    const target = new URL(targetBase, window.location.origin);
    const targetBasePath = String(target.pathname || "").replace(/\/+$/, "");
    const sourcePath = String(parsedUrl.pathname || "");
    const suffix = sourcePath.startsWith(API_V1_PREFIX)
      ? sourcePath.slice(API_V1_PREFIX.length)
      : sourcePath;

    target.pathname = `${targetBasePath}${suffix}`.replace(/\/{2,}/g, "/");
    target.search = parsedUrl.search || "";
    target.hash = parsedUrl.hash || "";
    return target.toString();
  } catch {
    return parsedUrl.toString();
  }
}

function isApiRequestUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== "string") return false;
  try {
    const parsed = new URL(inputUrl, window.location.origin);
    return parsed.pathname.includes("/api/");
  } catch {
    return false;
  }
}

function isAuthPublicEndpoint(inputUrl) {
  if (!inputUrl || typeof inputUrl !== "string") return false;
  try {
    const parsed = new URL(inputUrl, window.location.origin);
    const path = String(parsed.pathname || "");
    return (
      path.endsWith("/api/v1/signin") ||
      path.endsWith("/api/v1/signup") ||
      path.endsWith("/api/v1/password/first-login/change") ||
      path.endsWith("/api/v1/csrf-token")
    );
  } catch {
    return false;
  }
}

export async function fetchSessionStatus() {
  const response = await fetch(`${AUTH_API_BASE_URL}/session/status`, {
    method: "GET",
    credentials: "include",
  });

  const payload = await response.json().catch(() => ({ success: false, data: null }));
  return payload;
}

export function setupNetworkRuntime() {
  if (typeof window === "undefined") return;
  if (window.__smsNetworkRuntimePatched) return;
  window.__smsNetworkRuntimePatched = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    if (typeof input === "string") {
      const rewrittenUrl = rewriteLocalApiUrl(input);
      const finalInit = { ...(init || {}) };
      const method = String(finalInit.method || "GET").toUpperCase();
      const isApiCall = isApiRequestUrl(rewrittenUrl);
      if (isApiCall) {
        finalInit.credentials = finalInit.credentials || "include";
      }

      const headers = new Headers(finalInit.headers || {});
      if (isApiCall && isMutatingMethod(method)) {
        if (!isAuthPublicEndpoint(rewrittenUrl)) {
          const csrfToken = getCsrfToken();
          if (csrfToken && !headers.has("x-csrf-token")) {
            headers.set("x-csrf-token", csrfToken);
          }
        }
      }
      finalInit.headers = headers;
      return nativeFetch(rewrittenUrl, finalInit).then(async (response) => {
        if (
          isApiCall &&
          Number(response?.status || 0) === 401 &&
          !isAuthPublicEndpoint(rewrittenUrl)
        ) {
          const detail = await buildFetchResponseDetail(response, rewrittenUrl);
          triggerForcedLogout(detail);
        }
        return response;
      });
    }

    if (input instanceof Request) {
      const rewritten = rewriteLocalApiUrl(input.url);
      const finalInit = { ...(init || {}) };
      const isApiCall = isApiRequestUrl(rewritten);
      if (isApiCall) {
        finalInit.credentials = finalInit.credentials || input.credentials || "include";
      }

      const method = String(finalInit.method || input.method || "GET").toUpperCase();
      const headers = new Headers(finalInit.headers || input.headers || {});
      if (isApiCall && isMutatingMethod(method)) {
        if (!isAuthPublicEndpoint(rewritten)) {
          const csrfToken = getCsrfToken();
          if (csrfToken && !headers.has("x-csrf-token")) {
            headers.set("x-csrf-token", csrfToken);
          }
        }
      }
      finalInit.headers = headers;

      if (rewritten !== input.url) {
        return nativeFetch(new Request(rewritten, input), finalInit).then(
          async (response) => {
            if (
              isApiCall &&
              Number(response?.status || 0) === 401 &&
              !isAuthPublicEndpoint(rewritten)
            ) {
              const detail = await buildFetchResponseDetail(response, rewritten);
              triggerForcedLogout(detail);
            }
            return response;
          },
        );
      }
      return nativeFetch(input, finalInit).then(async (response) => {
        if (
          isApiCall &&
          Number(response?.status || 0) === 401 &&
          !isAuthPublicEndpoint(rewritten)
        ) {
          const detail = await buildFetchResponseDetail(response, rewritten);
          triggerForcedLogout(detail);
        }
        return response;
      });
    }

    return nativeFetch(input, init);
  };

  axios.interceptors.request.use((config) => {
    if (typeof config?.url === "string") {
      config.url = rewriteLocalApiUrl(config.url);
    }
    const isApiCall = isApiRequestUrl(config?.url || "");
    if (isApiCall) {
      config.withCredentials = true;
    }

    const method = String(config?.method || "get").toUpperCase();
    if (isApiCall && isMutatingMethod(method)) {
      if (!isAuthPublicEndpoint(config?.url || "")) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          config.headers = config.headers || {};
          if (!config.headers["x-csrf-token"]) {
            config.headers["x-csrf-token"] = csrfToken;
          }
        }
      }
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const url = String(error?.config?.url || "");
      const status = Number(error?.response?.status || 0);
      const detail = buildAxiosErrorDetail(error);
      const isPublicAuthRoute = isAuthPublicEndpoint(url);

      if (status === 401 && !isPublicAuthRoute) {
        triggerForcedLogout(detail);
      } else if (!url.includes("/signin")) {
        emitApiError(detail);
      }
      return Promise.reject(error);
    },
  );
}
