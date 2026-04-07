"use strict";

const {
  AccountActivationService,
  buildActivationError,
} = require("../services/account-activation-service");

const service = new AccountActivationService();

const normalizeText = (value) => String(value || "").trim();

const sendError = (req, res, error, fallback = {}) => {
  const statusCode = Number(error?.statusCode || fallback?.statusCode || 500);
  const code = normalizeText(error?.code || fallback?.code) || "ACCOUNT_ACTIVATION_FAILED";
  const message =
    normalizeText(error?.message || fallback?.message) ||
    "Unable to process account activation.";
  const hint = normalizeText(error?.hint || fallback?.hint);
  const requestId = normalizeText(req?.requestId) || null;
  const upstreamRequestId =
    normalizeText(error?.upstreamRequestId || fallback?.upstreamRequestId) || null;
  const details = Array.isArray(error?.details)
    ? error.details.map((entry) => normalizeText(entry)).filter(Boolean)
    : [];

  return res.status(statusCode).json({
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
  });
};

async function validateActivation(req, res) {
  try {
    const response = await service.validate(req.body || {}, {
      requestId: req.requestId || null,
    });

    return res.status(200).json({
      success: true,
      message:
        response.action === "already_exists"
          ? "Account already exists for this employee."
          : "Employee verified successfully. You can continue to activate the account.",
      data: response,
      requestId: normalizeText(req.requestId) || null,
      err: {},
    });
  } catch (error) {
    return sendError(req, res, error, {
      statusCode: 500,
      code: "ACCOUNT_ACTIVATION_VALIDATE_FAILED",
      message: "Unable to validate the account activation request.",
      hint: "Please try again in a moment.",
    });
  }
}

async function executeActivation(req, res) {
  try {
    const response = await service.execute(req.body || {}, {
      requestId: req.requestId || null,
    });

    return res.status(200).json({
      success: true,
      message: "Account activated successfully. Please sign in with your credentials.",
      data: response,
      requestId: normalizeText(req.requestId) || null,
      err: {},
    });
  } catch (error) {
    return sendError(req, res, error, {
      statusCode: 500,
      code: "ACCOUNT_ACTIVATION_EXECUTE_FAILED",
      message: "Unable to activate the account.",
      hint: "Please try again in a moment.",
    });
  }
}

async function verifyLoginEligibility(req, res) {
  try {
    const response = await service.verifyLoginEligibility(req.body || {});

    return res.status(200).json({
      success: true,
      message: "Employee login eligibility verified successfully.",
      data: response,
      requestId: normalizeText(req.requestId) || null,
      err: {},
    });
  } catch (error) {
    return sendError(req, res, error, {
      statusCode: 500,
      code: "STORE_LOGIN_ELIGIBILITY_FAILED",
      message: "Unable to verify Store employee eligibility.",
      hint: "Please try again in a moment.",
    });
  }
}

module.exports = {
  executeActivation,
  validateActivation,
  verifyLoginEligibility,
};
