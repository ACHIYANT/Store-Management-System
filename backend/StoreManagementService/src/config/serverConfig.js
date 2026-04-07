const dotenv = require("dotenv");

dotenv.config();

const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

module.exports = {
  PORT: process.env.PORT,
  AUTH_BASE_URL: process.env.AUTH_BASE_URL || "http://localhost:3001/api/v1",
  AUTH_REQUEST_TIMEOUT_MS: Number(process.env.AUTH_REQUEST_TIMEOUT_MS || 5000),
  AUTH_INTERNAL_SERVICE_KEY:
    process.env.AUTH_INTERNAL_SERVICE_KEY ||
    process.env.INTERNAL_SERVICE_SHARED_SECRET ||
    "",
  AUTH_INTERNAL_SERVICE_NAME:
    process.env.AUTH_INTERNAL_SERVICE_NAME || "StoreManagementService",
  INTERNAL_SERVICE_SHARED_SECRET:
    process.env.INTERNAL_SERVICE_SHARED_SECRET ||
    process.env.AUTH_INTERNAL_SERVICE_KEY ||
    "",
  INTERNAL_ALLOWED_SERVICE_NAMES: parseCsv(
    process.env.INTERNAL_ALLOWED_SERVICE_NAMES || "AuthService",
  ),
};
