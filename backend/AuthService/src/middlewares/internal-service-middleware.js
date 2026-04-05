"use strict";

const crypto = require("crypto");
const {
  INTERNAL_ALLOWED_SERVICE_NAMES,
  INTERNAL_SERVICE_SHARED_SECRET,
} = require("../config/serverConfig");
const { sendError } = require("../utils/auth-response-utils");

const INTERNAL_SERVICE_KEY_HEADER = "x-internal-service-key";
const INTERNAL_SERVICE_NAME_HEADER = "x-internal-service-name";

const normalizeText = (value) => String(value || "").trim();

const normalizeServiceName = (value) => normalizeText(value).toLowerCase();

const compareSecrets = (providedSecret, expectedSecret) => {
  const provided = Buffer.from(String(providedSecret || ""), "utf8");
  const expected = Buffer.from(String(expectedSecret || ""), "utf8");
  if (!provided.length || !expected.length || provided.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(provided, expected);
};

function ensureInternalService(req, res, next) {
  const configuredSecret = normalizeText(INTERNAL_SERVICE_SHARED_SECRET);
  const serviceName = normalizeText(req.headers[INTERNAL_SERVICE_NAME_HEADER]);
  const providedSecret = normalizeText(req.headers[INTERNAL_SERVICE_KEY_HEADER]);
  const allowedServiceNames = Array.isArray(INTERNAL_ALLOWED_SERVICE_NAMES)
    ? INTERNAL_ALLOWED_SERVICE_NAMES.map(normalizeServiceName).filter(Boolean)
    : [];

  if (!configuredSecret) {
    return sendError(req, res, {
      statusCode: 503,
      code: "INTERNAL_SERVICE_NOT_CONFIGURED",
      message: "Internal provisioning is not configured.",
      hint: "Configure the internal service shared secret and try again.",
    });
  }

  if (!serviceName) {
    return sendError(req, res, {
      statusCode: 401,
      code: "INTERNAL_SERVICE_NAME_MISSING",
      message: "Internal service name is missing.",
      hint: "Provide a valid internal service name to continue.",
    });
  }

  if (!providedSecret) {
    return sendError(req, res, {
      statusCode: 401,
      code: "INTERNAL_SERVICE_KEY_MISSING",
      message: "Internal service key is missing.",
      hint: "Provide a valid internal service key to continue.",
    });
  }

  if (
    allowedServiceNames.length > 0 &&
    !allowedServiceNames.includes(normalizeServiceName(serviceName))
  ) {
    return sendError(req, res, {
      statusCode: 403,
      code: "INTERNAL_SERVICE_FORBIDDEN",
      message: "This internal service is not allowed to call this endpoint.",
      hint: "Use an approved internal service identity to continue.",
    });
  }

  if (!compareSecrets(providedSecret, configuredSecret)) {
    return sendError(req, res, {
      statusCode: 403,
      code: "INTERNAL_SERVICE_FORBIDDEN",
      message: "Internal service authentication failed.",
      hint: "Use a valid internal service credential to continue.",
    });
  }

  req.internalService = {
    serviceName,
  };
  req.user = {
    id: null,
    empcode: null,
    fullname: serviceName,
    designation: "Internal Service",
    division: null,
    roles: ["INTERNAL_SERVICE"],
  };
  return next();
}

module.exports = {
  ensureInternalService,
  INTERNAL_SERVICE_KEY_HEADER,
  INTERNAL_SERVICE_NAME_HEADER,
};
