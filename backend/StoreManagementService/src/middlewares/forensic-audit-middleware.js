"use strict";

const {
  forensicAuditService,
  getEntityIdFromRequest,
  getEntityTypeFromPath,
  sanitizeAuditPayload,
  truncateText,
} = require("../services/forensic-audit-service");

const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
};

const getResolvedRoutePath = (req) => {
  const fallbackPath = String(req.originalUrl || req.url || "").split("?")[0] || "/";
  if (req.baseUrl && req.route?.path) {
    const routePath =
      typeof req.route.path === "string" ? req.route.path : fallbackPath;
    return `${req.baseUrl}${routePath}`;
  }
  return fallbackPath;
};

const getResponseErrorMessage = (payload) => {
  if (!payload) return null;
  if (typeof payload === "string") return truncateText(payload, 600);
  if (typeof payload !== "object") return null;
  if (payload.message) return truncateText(payload.message, 600);
  if (payload.err?.message) return truncateText(payload.err.message, 600);
  return null;
};

const captureResponsePayload = (res, body) => {
  if (res.locals.__forensicAuditResponseCaptured) return;
  res.locals.__forensicAuditResponseCaptured = true;

  if (body === undefined) {
    res.locals.__forensicAuditResponsePayload = null;
    return;
  }

  if (Buffer.isBuffer(body)) {
    res.locals.__forensicAuditResponsePayload = `[Buffer:${body.length}]`;
    return;
  }

  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) {
      res.locals.__forensicAuditResponsePayload = "";
      return;
    }
    try {
      res.locals.__forensicAuditResponsePayload = sanitizeAuditPayload(
        JSON.parse(trimmed),
      );
      return;
    } catch {
      res.locals.__forensicAuditResponsePayload = truncateText(trimmed, 2000);
      return;
    }
  }

  res.locals.__forensicAuditResponsePayload = sanitizeAuditPayload(body);
};

const forensicAuditMiddleware = () => (req, res, next) => {
  if (!forensicAuditService.isEnabled()) return next();
  if (forensicAuditService.shouldSkipPath(req.originalUrl || req.url || "")) {
    return next();
  }

  const requestStartedAt = Number(req.requestStartedAt || Date.now());
  const startedAt = new Date(requestStartedAt);

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = (body) => {
    captureResponsePayload(res, body);
    return originalJson(body);
  };

  res.send = (body) => {
    captureResponsePayload(res, body);
    return originalSend(body);
  };

  res.on("finish", () => {
    const completedAt = new Date();
    const durationMs = Math.max(0, Date.now() - requestStartedAt);
    const routePath = getResolvedRoutePath(req);
    const entityType = getEntityTypeFromPath(routePath);
    const action = `${req.method} ${routePath}`;
    const statusCode = Number(res.statusCode || 0);
    const responsePayload = res.locals.__forensicAuditResponsePayload;
    const actor = req.user || {};
    const roles = Array.isArray(actor.roles)
      ? actor.roles.filter(Boolean).join(",")
      : actor.roles || null;
    const actorUserId = actor.id ? Number(actor.id) : null;

    setImmediate(() => {
      forensicAuditService.recordEvent({
        requestId: req.requestId,
        method: req.method,
        routePath,
        action,
        entityType,
        entityId: getEntityIdFromRequest(req),
        statusCode,
        success: statusCode > 0 && statusCode < 400,
        durationMs,
        actorUserId: Number.isFinite(actorUserId) ? actorUserId : null,
        actorEmpCode: actor.empcode || actor.emp_id || null,
        actorName: actor.fullname || actor.name || null,
        actorRoles: roles ? truncateText(roles, 255) : null,
        sourceIp: getClientIp(req),
        userAgent: req.headers["user-agent"] || null,
        queryJson: req.query || null,
        requestBodyJson: req.body || null,
        responseBodyJson: responsePayload === undefined ? null : responsePayload,
        errorMessage: statusCode >= 500 ? getResponseErrorMessage(responsePayload) : null,
        metadataJson: {
          base_url: req.baseUrl || null,
          original_url: req.originalUrl || null,
          route_path: req.route?.path || null,
        },
        startedAt,
        completedAt,
      });
    });
  });

  return next();
};

module.exports = {
  forensicAuditMiddleware,
};

