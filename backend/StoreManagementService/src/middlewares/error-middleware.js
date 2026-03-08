"use strict";

const multer = require("multer");

const multerStatusCodeByError = {
  LIMIT_PART_COUNT: 400,
  LIMIT_FILE_SIZE: 413,
  LIMIT_FILE_COUNT: 400,
  LIMIT_FIELD_KEY: 400,
  LIMIT_FIELD_VALUE: 400,
  LIMIT_FIELD_COUNT: 400,
  LIMIT_UNEXPECTED_FILE: 400,
};

const buildMulterMessage = (error) => {
  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    const field = error.field ? ` '${error.field}'` : "";
    return `Unexpected upload field${field}. Use the expected file field name.`;
  }
  if (error.code === "LIMIT_FILE_SIZE") {
    return "Uploaded file exceeds allowed size.";
  }
  return error.message || "Invalid upload payload.";
};

const apiErrorHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    const statusCode = multerStatusCodeByError[error.code] || 400;
    return res.status(statusCode).json({
      success: false,
      message: "File upload validation failed",
      data: {},
      err: {
        type: "MulterError",
        code: error.code,
        field: error.field || null,
        message: buildMulterMessage(error),
      },
    });
  }

  const statusCode = Number(error?.statusCode || error?.status || 500);
  const message =
    statusCode >= 500
      ? "Internal server error"
      : error?.message || "Request failed";

  if (statusCode >= 500) {
    console.error("Unhandled API error:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    data: {},
    err:
      statusCode >= 500
        ? {}
        : {
            message: error?.message || "Request failed",
          },
  });
};

module.exports = {
  apiErrorHandler,
};

