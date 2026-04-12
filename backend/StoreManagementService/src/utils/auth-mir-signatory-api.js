"use strict";

const axios = require("axios");
const {
  AUTH_BASE_URL,
  AUTH_INTERNAL_SERVICE_KEY,
  AUTH_INTERNAL_SERVICE_NAME,
  AUTH_REQUEST_TIMEOUT_MS,
} = require("../config/serverConfig");

const normalizeText = (value) => String(value || "").trim();

const normalizeBaseUrl = (value) => normalizeText(value).replace(/\/+$/, "");

const buildMirSignatoryError = ({
  statusCode = 500,
  code = "AUTH_MIR_SIGNATORY_FAILED",
  message = "Unable to resolve MIR signatory.",
  hint = "Please try again in a moment.",
  upstreamRequestId = null,
} = {}) => ({
  statusCode,
  code,
  message,
  hint,
  upstreamRequestId: normalizeText(upstreamRequestId) || null,
});

async function resolveMirSignatoryInAuthService(payload = {}, options = {}) {
  const baseUrl = normalizeBaseUrl(AUTH_BASE_URL);
  const sharedSecret = normalizeText(AUTH_INTERNAL_SERVICE_KEY);
  const serviceName =
    normalizeText(options?.serviceName) || normalizeText(AUTH_INTERNAL_SERVICE_NAME);
  const requestId = normalizeText(options?.requestId) || undefined;

  if (!baseUrl) {
    throw buildMirSignatoryError({
      statusCode: 503,
      code: "AUTH_MIR_SIGNATORY_NOT_CONFIGURED",
      message: "Auth base URL is not configured.",
      hint: "Configure AUTH_BASE_URL in Store service and try again.",
    });
  }

  if (!sharedSecret) {
    throw buildMirSignatoryError({
      statusCode: 503,
      code: "AUTH_MIR_SIGNATORY_NOT_CONFIGURED",
      message: "Store-to-Auth internal credential is not configured.",
      hint: "Configure AUTH_INTERNAL_SERVICE_KEY in Store service and try again.",
    });
  }

  try {
    const response = await axios.post(
      `${baseUrl}/internal/users/resolve-mir-signatory`,
      payload,
      {
        headers: {
          "x-internal-service-key": sharedSecret,
          "x-internal-service-name": serviceName || "StoreManagementService",
          "x-request-id": requestId,
        },
        timeout: Number(AUTH_REQUEST_TIMEOUT_MS || 5000),
      },
    );

    const data = response?.data?.data || {};
    return {
      assignmentType: normalizeText(data?.assignment_type || payload?.assignmentType) || null,
      scopeKey: normalizeText(data?.scope_key || payload?.scopeKey) || null,
      holderCount: Number(data?.holder_count || 0),
      primaryHolder: data?.primary_holder || null,
      holders: Array.isArray(data?.holders) ? data.holders : [],
      requestId:
        normalizeText(response?.headers?.["x-request-id"]) ||
        normalizeText(response?.data?.requestId) ||
        null,
    };
  } catch (error) {
    const payloadData = error?.response?.data || {};
    const upstreamRequestId =
      normalizeText(error?.response?.headers?.["x-request-id"]) ||
      normalizeText(payloadData?.requestId) ||
      null;

    if (error?.response) {
      throw buildMirSignatoryError({
        statusCode: Number(error.response.status || 500),
        code:
          normalizeText(payloadData?.code || payloadData?.err?.code) ||
          "AUTH_MIR_SIGNATORY_FAILED",
        message:
          normalizeText(payloadData?.message || payloadData?.err?.message) ||
          "Unable to resolve MIR signatory.",
        hint: normalizeText(payloadData?.hint) || "Please try again in a moment.",
        upstreamRequestId,
      });
    }

    if (error?.code === "ECONNABORTED") {
      throw buildMirSignatoryError({
        statusCode: 503,
        code: "AUTH_MIR_SIGNATORY_TIMEOUT",
        message: "Auth MIR signatory resolution timed out.",
        hint: "Please try again in a moment.",
        upstreamRequestId,
      });
    }

    throw buildMirSignatoryError({
      statusCode: 503,
      code: "AUTH_MIR_SIGNATORY_UNREACHABLE",
      message: "Auth MIR signatory service could not be reached.",
      hint: "Please try again in a moment.",
      upstreamRequestId,
    });
  }
}

module.exports = {
  resolveMirSignatoryInAuthService,
};
