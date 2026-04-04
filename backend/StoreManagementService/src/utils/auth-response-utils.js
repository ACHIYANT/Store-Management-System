"use strict";

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

const buildAuthErrorPayload = (req, res, error = {}, fallback = {}) => {
  const statusCode = Number(error?.statusCode || fallback?.statusCode || 401);
  const code = normalizeText(error?.code || fallback?.code) || "UNAUTHORIZED";
  const message =
    normalizeText(error?.message || fallback?.message) || "Unauthorized.";
  const hint = normalizeText(error?.hint || fallback?.hint);
  const requestId =
    normalizeText(res?.getHeader?.("x-request-id")) ||
    normalizeText(req?.requestId) ||
    null;
  const upstreamRequestId =
    normalizeText(error?.upstreamRequestId || fallback?.upstreamRequestId) ||
    null;
  const details = normalizeDetails(error?.details || fallback?.details);

  return {
    success: false,
    statusCode,
    code,
    message,
    hint,
    requestId,
    upstreamRequestId,
    data: {},
    details: details.length ? details : undefined,
    err: {
      code,
      message,
    },
  };
};

const sendAuthError = (req, res, error = {}, fallback = {}) =>
  res
    .status(Number(error?.statusCode || fallback?.statusCode || 401))
    .json(buildAuthErrorPayload(req, res, error, fallback));

module.exports = {
  buildAuthErrorPayload,
  sendAuthError,
};
