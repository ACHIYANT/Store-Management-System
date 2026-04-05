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

const buildProvisionError = ({
  statusCode = 500,
  code = "AUTH_PROVISION_FAILED",
  message = "Unable to provision the Auth account.",
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

const buildProvisionPayload = (employee = {}) => ({
  empcode: employee?.emp_id,
  fullname: employee?.name,
  mobileno: employee?.mobile_no,
  designation: employee?.designation,
  division: employee?.division,
});

async function callAuthProvisionApi(mode = "validate", employeePayload = {}, options = {}) {
  const baseUrl = normalizeBaseUrl(AUTH_BASE_URL);
  const sharedSecret = normalizeText(AUTH_INTERNAL_SERVICE_KEY);
  const serviceName =
    normalizeText(options?.serviceName) || normalizeText(AUTH_INTERNAL_SERVICE_NAME);
  const normalizedMode = normalizeText(mode).toLowerCase();

  if (!["validate", "execute"].includes(normalizedMode)) {
    throw buildProvisionError({
      statusCode: 500,
      code: "AUTH_PROVISION_MODE_INVALID",
      message: "Provisioning mode is invalid.",
      hint: "Use a valid provisioning mode and try again.",
    });
  }

  if (!baseUrl) {
    throw buildProvisionError({
      statusCode: 503,
      code: "AUTH_PROVISION_NOT_CONFIGURED",
      message: "Auth provisioning endpoint is not configured.",
      hint: "Configure AUTH_BASE_URL in Store service and try again.",
    });
  }

  if (!sharedSecret) {
    throw buildProvisionError({
      statusCode: 503,
      code: "AUTH_PROVISION_NOT_CONFIGURED",
      message: "Store-to-Auth provisioning credential is not configured.",
      hint: "Configure AUTH_INTERNAL_SERVICE_KEY in Store service and try again.",
    });
  }

  const requestId = normalizeText(options?.requestId) || undefined;

  try {
    const response = await axios.post(
      `${baseUrl}/internal/users/provision-from-employee/${normalizedMode}`,
      buildProvisionPayload(employeePayload),
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
      action: normalizeText(response?.data?.data?.action) || "created",
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
      throw buildProvisionError({
        statusCode: Number(error.response.status || 500),
        code:
          normalizeText(payload?.code || payload?.err?.code) ||
          "AUTH_PROVISION_FAILED",
        message:
          normalizeText(payload?.message || payload?.err?.message) ||
          "Unable to provision the Auth account.",
        hint:
          normalizeText(payload?.hint) ||
          "Please review the employee details and try again.",
        details: Array.isArray(payload?.details) ? payload.details : [],
        upstreamRequestId,
      });
    }

    if (error?.code === "ECONNABORTED") {
      throw buildProvisionError({
        statusCode: 503,
        code: "AUTH_PROVISION_TIMEOUT",
        message: "Auth provisioning request timed out.",
        hint: "Please try again in a moment.",
        upstreamRequestId,
      });
    }

    throw buildProvisionError({
      statusCode: 503,
      code: "AUTH_PROVISION_UNREACHABLE",
      message: "Auth provisioning service could not be reached.",
      hint: "Please try again in a moment.",
      upstreamRequestId,
    });
  }
}

const validateEmployeeProvisionInAuthService = (employeePayload = {}, options = {}) =>
  callAuthProvisionApi("validate", employeePayload, options);

const executeEmployeeProvisionInAuthService = (employeePayload = {}, options = {}) =>
  callAuthProvisionApi("execute", employeePayload, options);

module.exports = {
  validateEmployeeProvisionInAuthService,
  executeEmployeeProvisionInAuthService,
};
