const dotenv = require("dotenv");
dotenv.config();

const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

module.exports = {
  PORT: Number(process.env.PORT || 3001),
  SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS || 12),
  JWT_KEY: process.env.JWT_KEY,
  PASSWORD_CHANGE_JWT_KEY:
    process.env.PASSWORD_CHANGE_JWT_KEY || process.env.JWT_KEY,
  PASSWORD_CHANGE_TOKEN_TTL:
    process.env.PASSWORD_CHANGE_TOKEN_TTL || "15m",
  INTERNAL_SERVICE_SHARED_SECRET:
    process.env.INTERNAL_SERVICE_SHARED_SECRET ||
    process.env.AUTH_INTERNAL_SERVICE_KEY ||
    "",
  INTERNAL_ALLOWED_SERVICE_NAMES: parseCsv(
    process.env.INTERNAL_ALLOWED_SERVICE_NAMES || "StoreManagementService",
  ),
  EMPLOYEE_PROVISION_DEFAULT_PASSWORD:
    process.env.EMPLOYEE_PROVISION_DEFAULT_PASSWORD ||
    process.env.EMPLOYEE_ONBOARDING_DEFAULT_PASSWORD ||
    "Hartron@123",
  STORE_BASE_URL: process.env.STORE_BASE_URL || "http://localhost:3000/api/v1",
  STORE_INTERNAL_SERVICE_KEY:
    process.env.STORE_INTERNAL_SERVICE_KEY ||
    process.env.INTERNAL_SERVICE_SHARED_SECRET ||
    "",
  STORE_INTERNAL_SERVICE_NAME:
    process.env.STORE_INTERNAL_SERVICE_NAME || "AuthService",
  STORE_VERIFICATION_REQUEST_TIMEOUT_MS: Number(
    process.env.STORE_VERIFICATION_REQUEST_TIMEOUT_MS || 5000,
  ),
};
