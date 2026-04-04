"use strict";

const DEFAULT_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const DEFAULT_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "x-access-token",
  "x-csrf-token",
  "X-Requested-With",
];
const DEFAULT_EXPOSED_HEADERS = ["x-request-id", "retry-after"];

const toPosInt = (value, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
};

const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

function buildCorsOptions() {
  const allowedOrigins = parseCsv(process.env.CORS_ALLOWED_ORIGINS);
  const allowedMethods = parseCsv(process.env.CORS_ALLOWED_METHODS);
  const allowedHeaders = parseCsv(process.env.CORS_ALLOWED_HEADERS);
  const exposedHeaders = parseCsv(process.env.CORS_EXPOSED_HEADERS);
  const isProduction =
    String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const allowAnyInDev =
    String(process.env.CORS_DEV_ALLOW_ANY || "true").toLowerCase() !== "false";

  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (!isProduction && allowAnyInDev) return callback(null, true);
      if (!allowedOrigins.length) {
        if (isProduction) return callback(new Error("CORS_NOT_ALLOWED"));
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS_NOT_ALLOWED"));
    },
    credentials: true,
    methods: allowedMethods.length ? allowedMethods : DEFAULT_ALLOWED_METHODS,
    allowedHeaders: allowedHeaders.length ? allowedHeaders : DEFAULT_ALLOWED_HEADERS,
    exposedHeaders: exposedHeaders.length ? exposedHeaders : DEFAULT_EXPOSED_HEADERS,
    maxAge: toPosInt(process.env.CORS_MAX_AGE_SECONDS, 86400),
  };
}

function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (String(process.env.ENABLE_HSTS || "").toLowerCase() === "true") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

function createInMemoryRateLimiter({ windowMs, maxRequests, keyGenerator, message }) {
  const store = new Map();
  const cleanupEveryMs = Math.max(windowMs, 60_000);

  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (!value || value.resetAt <= now) store.delete(key);
    }
  }, cleanupEveryMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = String(keyGenerator(req) || req.ip || "anon");
    const current = store.get(key);

    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    store.set(key, current);

    if (current.count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        success: false,
        message: message || "Too many requests. Please try again later.",
        data: {},
        err: {},
      });
    }

    return next();
  };
}

const apiRateLimiter = createInMemoryRateLimiter({
  windowMs: toPosInt(process.env.API_RATE_LIMIT_WINDOW_MS, 60_000),
  maxRequests: toPosInt(process.env.API_RATE_LIMIT_MAX, 500),
  keyGenerator: (req) => req.ip,
  message: "Too many API requests from this IP.",
});

function sanitizeJsonErrorResponses(_req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (!payload || typeof payload !== "object" || !("err" in payload)) {
      return originalJson(payload);
    }

    const statusCode = Number(res.statusCode || 200);
    const safePayload = { ...payload };
    const errValue = safePayload.err;

    if (statusCode >= 500) {
      safePayload.err = {};
      return originalJson(safePayload);
    }

    if (typeof errValue === "string") {
      safePayload.err = { message: errValue };
      return originalJson(safePayload);
    }

    if (errValue && typeof errValue === "object") {
      const safeErr = {};
      if (typeof errValue.message === "string" && errValue.message.trim()) {
        safeErr.message = errValue.message;
      }
      if (typeof errValue.code === "string" && errValue.code.trim()) {
        safeErr.code = errValue.code;
      }
      if (typeof errValue.type === "string" && errValue.type.trim()) {
        safeErr.type = errValue.type;
      }
      if (typeof errValue.field === "string" && errValue.field.trim()) {
        safeErr.field = errValue.field;
      }
      safePayload.err = safeErr;
      return originalJson(safePayload);
    }

    safePayload.err = {};
    return originalJson(safePayload);
  };
  next();
}

module.exports = {
  apiRateLimiter,
  buildCorsOptions,
  sanitizeJsonErrorResponses,
  securityHeaders,
};
