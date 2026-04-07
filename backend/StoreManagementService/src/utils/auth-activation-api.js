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

const buildActivationError = ({
  statusCode = 500,
  code = "AUTH_ACTIVATION_FAILED",
  message = "Unable to activate the Auth account.",
  hint = "Please try again in a moment.",
  details = [],
  upstreamRequestId = null,
} = {}) => ({
  statusCode,
  code,
  message,
  hint,
  details: Array.isArray(details)
    ? details.map((entry) => normalizeText(entry)).filter(Boolean)
    : [],
  upstreamRequestId: normalizeText(upstreamRequestId) || null,
});

const normalizeBaseUrl = (value) => normalizeText(value).replace(/\/+$/, "");

const buildActivationPayload = (
  employee = {},
  { newPassword = "", confirmPassword = "" } = {},
) => {
  const payload = {
    empcode: employee?.emp_id,
    fullname: employee?.name,
    mobileno: employee?.mobile_no,
    designation: employee?.designation,
    division: employee?.division,
  };

  if (String(newPassword || "")) {
    payload.newPassword = String(newPassword);
  }
  if (String(confirmPassword || "")) {
    payload.confirmPassword = String(confirmPassword);
  }

  return payload;
};

async function callAuthActivationApi(
  mode = "validate",
  employeePayload = {},
  credentials = {},
  options = {},
) {
  const baseUrl = normalizeBaseUrl(AUTH_BASE_URL);
  const sharedSecret = normalizeText(AUTH_INTERNAL_SERVICE_KEY);
  const serviceName =
    normalizeText(options?.serviceName) || normalizeText(AUTH_INTERNAL_SERVICE_NAME);
  const normalizedMode = normalizeText(mode).toLowerCase();

  if (!["validate", "execute"].includes(normalizedMode)) {
    throw buildActivationError({
      statusCode: 500,
      code: "AUTH_ACTIVATION_MODE_INVALID",
      message: "Activation mode is invalid.",
      hint: "Use a valid activation mode and try again.",
    });
  }

  if (!baseUrl) {
    throw buildActivationError({
      statusCode: 503,
      code: "AUTH_ACTIVATION_NOT_CONFIGURED",
      message: "Auth activation endpoint is not configured.",
      hint: "Configure AUTH_BASE_URL in Store service and try again.",
    });
  }

  if (!sharedSecret) {
    throw buildActivationError({
      statusCode: 503,
      code: "AUTH_ACTIVATION_NOT_CONFIGURED",
      message: "Store-to-Auth activation credential is not configured.",
      hint: "Configure AUTH_INTERNAL_SERVICE_KEY in Store service and try again.",
    });
  }

  const requestId = normalizeText(options?.requestId) || undefined;

  try {
    const response = await axios.post(
      `${baseUrl}/internal/users/activate-from-employee/${normalizedMode}`,
      buildActivationPayload(employeePayload, credentials),
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
      action: normalizeText(response?.data?.data?.action) || "activated",
      activation_state:
        normalizeText(response?.data?.data?.activation_state) || null,
      user: response?.data?.data?.user || null,
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
      throw buildActivationError({
        statusCode: Number(error.response.status || 500),
        code:
          normalizeText(payload?.code || payload?.err?.code) ||
          "AUTH_ACTIVATION_FAILED",
        message:
          normalizeText(payload?.message || payload?.err?.message) ||
          "Unable to activate the Auth account.",
        hint:
          normalizeText(payload?.hint) ||
          "Please review the employee details and try again.",
        details: Array.isArray(payload?.details) ? payload.details : [],
        upstreamRequestId,
      });
    }

    if (error?.code === "ECONNABORTED") {
      throw buildActivationError({
        statusCode: 503,
        code: "AUTH_ACTIVATION_TIMEOUT",
        message: "Auth activation request timed out.",
        hint: "Please try again in a moment.",
        upstreamRequestId,
      });
    }

    throw buildActivationError({
      statusCode: 503,
      code: "AUTH_ACTIVATION_UNREACHABLE",
      message: "Auth activation service could not be reached.",
      hint: "Please try again in a moment.",
      upstreamRequestId,
    });
  }
}

const validateEmployeeActivationInAuthService = (
  employeePayload = {},
  options = {},
) => callAuthActivationApi("validate", employeePayload, {}, options);

const executeEmployeeActivationInAuthService = (
  employeePayload = {},
  credentials = {},
  options = {},
) => callAuthActivationApi("execute", employeePayload, credentials, options);

module.exports = {
  validateEmployeeActivationInAuthService,
  executeEmployeeActivationInAuthService,
};
