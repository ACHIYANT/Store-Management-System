"use strict";

const axios = require("axios");
const {
  AUTH_BASE_URL,
  AUTH_INTERNAL_SERVICE_KEY,
  AUTH_INTERNAL_SERVICE_NAME,
  AUTH_REQUEST_TIMEOUT_MS,
} = require("../config/serverConfig");

const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || "";
};

const normalizeBaseUrl = (value) => normalizeText(value).replace(/\/+$/, "");

const buildPendingHolderError = ({
  statusCode = 500,
  code = "AUTH_PENDING_HOLDERS_FAILED",
  message = "Unable to resolve pending queue holders.",
  hint = "Please try again in a moment.",
  upstreamRequestId = null,
} = {}) => ({
  statusCode,
  code,
  message,
  hint,
  upstreamRequestId: normalizeText(upstreamRequestId) || null,
});

async function resolvePendingQueueHoldersInAuthService(targets = [], options = {}) {
  const baseUrl = normalizeBaseUrl(AUTH_BASE_URL);
  const sharedSecret = normalizeText(AUTH_INTERNAL_SERVICE_KEY);
  const serviceName =
    normalizeText(options?.serviceName) || normalizeText(AUTH_INTERNAL_SERVICE_NAME);
  const requestId = normalizeText(options?.requestId) || undefined;

  if (!baseUrl) {
    throw buildPendingHolderError({
      statusCode: 503,
      code: "AUTH_PENDING_HOLDERS_NOT_CONFIGURED",
      message: "Auth base URL is not configured.",
      hint: "Configure AUTH_BASE_URL in Store service and try again.",
    });
  }

  if (!sharedSecret) {
    throw buildPendingHolderError({
      statusCode: 503,
      code: "AUTH_PENDING_HOLDERS_NOT_CONFIGURED",
      message: "Store-to-Auth internal credential is not configured.",
      hint: "Configure AUTH_INTERNAL_SERVICE_KEY in Store service and try again.",
    });
  }

  try {
    const response = await axios.post(
      `${baseUrl}/internal/users/resolve-pending-queue-holders`,
      { targets: Array.isArray(targets) ? targets : [] },
      {
        headers: {
          "x-internal-service-key": sharedSecret,
          "x-internal-service-name": serviceName || "StoreManagementService",
          "x-request-id": requestId,
        },
        timeout: Number(AUTH_REQUEST_TIMEOUT_MS || 5000),
      },
    );

    return {
      targets: Array.isArray(response?.data?.data?.targets)
        ? response.data.data.targets
        : [],
      requestId:
        normalizeText(response?.headers?.["x-request-id"]) ||
        normalizeText(response?.data?.requestId) ||
        null,
    };
  } catch (error) {
    const payload = error?.response?.data || {};
    const upstreamRequestId =
      normalizeText(error?.response?.headers?.["x-request-id"]) ||
      normalizeText(payload?.requestId) ||
      null;

    if (error?.response) {
      throw buildPendingHolderError({
        statusCode: Number(error.response.status || 500),
        code:
          normalizeText(payload?.code || payload?.err?.code) ||
          "AUTH_PENDING_HOLDERS_FAILED",
        message:
          normalizeText(payload?.message || payload?.err?.message) ||
          "Unable to resolve pending queue holders.",
        hint:
          normalizeText(payload?.hint) ||
          "Please try again in a moment.",
        upstreamRequestId,
      });
    }

    if (error?.code === "ECONNABORTED") {
      throw buildPendingHolderError({
        statusCode: 503,
        code: "AUTH_PENDING_HOLDERS_TIMEOUT",
        message: "Auth pending-holder resolution timed out.",
        hint: "Please try again in a moment.",
        upstreamRequestId,
      });
    }

    throw buildPendingHolderError({
      statusCode: 503,
      code: "AUTH_PENDING_HOLDERS_UNREACHABLE",
      message: "Auth pending-holder service could not be reached.",
      hint: "Please try again in a moment.",
      upstreamRequestId,
    });
  }
}

module.exports = {
  resolvePendingQueueHoldersInAuthService,
};
