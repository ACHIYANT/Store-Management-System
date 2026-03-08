"use strict";

const { randomUUID } = require("crypto");

const MAX_REQUEST_ID_LENGTH = 128;

const normalizeRequestId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.length > MAX_REQUEST_ID_LENGTH) {
    return raw.slice(0, MAX_REQUEST_ID_LENGTH);
  }
  return raw;
};

const requestContextMiddleware = (req, res, next) => {
  const incomingRequestId = normalizeRequestId(req.headers["x-request-id"]);
  const requestId = incomingRequestId || randomUUID();

  req.requestId = requestId;
  req.requestStartedAt = Date.now();
  res.setHeader("x-request-id", requestId);
  return next();
};

module.exports = {
  requestContextMiddleware,
};

