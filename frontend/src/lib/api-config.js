const trimTrailingSlash = (value = "") => String(value || "").replace(/\/+$/, "");

const DEFAULT_STORE_API_URL = "http://localhost:3000/api/v1";
const DEFAULT_AUTH_API_URL = "http://localhost:3001/api/v1";

export const STORE_API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_STORE_API_URL || DEFAULT_STORE_API_URL,
);

export const AUTH_API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_AUTH_API_URL || DEFAULT_AUTH_API_URL,
);

const normalizePath = (path = "") => {
  const raw = String(path || "").trim();
  if (!raw) return "";
  return raw.startsWith("/") ? raw : `/${raw}`;
};

export const toStoreApiUrl = (path = "") =>
  `${STORE_API_BASE_URL}${normalizePath(path)}`;

export const toAuthApiUrl = (path = "") =>
  `${AUTH_API_BASE_URL}${normalizePath(path)}`;

