import axios from "axios";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
let forcedLogoutInProgress = false;

function getRuntimeHostname() {
  if (typeof window === "undefined") return "localhost";
  return window.location.hostname || "localhost";
}

function isLoopbackHost(hostname = "") {
  return LOOPBACK_HOSTS.has(String(hostname).toLowerCase());
}

function shouldRewriteLoopback() {
  const runtimeHost = getRuntimeHostname();
  return !isLoopbackHost(runtimeHost);
}

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

function emitApiError(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("sms:api-error", {
      detail,
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

function triggerForcedLogout(message = "Unauthorized. Please login again.") {
  if (typeof window === "undefined") return;
  if (forcedLogoutInProgress) return;

  forcedLogoutInProgress = true;
  const normalizedMessage =
    typeof message === "string" && message.trim()
      ? message.trim()
      : "Unauthorized. Please login again.";

  clearClientSessionData();

  emitApiError({
    status: 401,
    message: normalizedMessage,
    forceLogout: true,
    redirectTo: "/login",
  });

  // Avoid duplicate dialogs from repeated in-flight unauthorized requests.
  setTimeout(() => {
    forcedLogoutInProgress = false;
  }, 5000);
}

function getApiErrorMessage(error) {
  const status = error?.response?.status;
  if (status === 401) return "Unauthorized. Please login again.";
  if (status === 403) return "You are not allowed to perform this action.";

  const payload = error?.response?.data || {};
  return (
    payload?.message ||
    payload?.error ||
    (typeof payload === "string" ? payload : "") ||
    error?.message ||
    "Request failed."
  );
}

export function rewriteLocalApiUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== "string") return inputUrl;

  let parsed;
  try {
    parsed = new URL(inputUrl, window.location.origin);
  } catch {
    return inputUrl;
  }

  // Only rewrite absolute loopback URLs when app is opened via LAN IP/host.
  if (!isLoopbackHost(parsed.hostname) || !shouldRewriteLoopback()) {
    return inputUrl;
  }

  parsed.hostname = getRuntimeHostname();
  if (typeof window !== "undefined" && window.location.protocol) {
    parsed.protocol = window.location.protocol;
  }

  return parsed.toString();
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
      path.endsWith("/api/v1/csrf-token")
    );
  } catch {
    return false;
  }
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
      return nativeFetch(rewrittenUrl, finalInit).then((response) => {
        if (
          isApiCall &&
          Number(response?.status || 0) === 401 &&
          !isAuthPublicEndpoint(rewrittenUrl)
        ) {
          triggerForcedLogout("Unauthorized. Please login again.");
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
          (response) => {
            if (
              isApiCall &&
              Number(response?.status || 0) === 401 &&
              !isAuthPublicEndpoint(rewritten)
            ) {
              triggerForcedLogout("Unauthorized. Please login again.");
            }
            return response;
          },
        );
      }
      return nativeFetch(input, finalInit).then((response) => {
        if (
          isApiCall &&
          Number(response?.status || 0) === 401 &&
          !isAuthPublicEndpoint(rewritten)
        ) {
          triggerForcedLogout("Unauthorized. Please login again.");
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
      const message = getApiErrorMessage(error);
      const isPublicAuthRoute = isAuthPublicEndpoint(url);

      if (status === 401 && !isPublicAuthRoute) {
        triggerForcedLogout(message);
      } else if (!url.includes("/signin")) {
        emitApiError({
          status,
          message,
        });
      }
      return Promise.reject(error);
    },
  );

}
