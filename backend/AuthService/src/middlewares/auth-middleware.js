const jwt = require("jsonwebtoken");
const UserRepository = require("../repository/user-repository");
const { JWT_KEY } = require("../config/serverConfig");
const { AUTH_COOKIE_NAME, parseCookies } = require("../utils/cookie-utils");
const { sendError } = require("../utils/auth-response-utils");

const userRepository = new UserRepository();

const normalizeRoles = (roles) =>
  Array.isArray(roles)
    ? roles.map((role) => String(role || "").toUpperCase()).filter(Boolean)
    : [];

const extractTokenFromCookie = (cookieHeader = "") =>
  parseCookies(cookieHeader)[AUTH_COOKIE_NAME] || "";

const extractToken = (req) =>
  req.headers["x-access-token"] ||
  (req.headers.authorization || "").replace(/^Bearer\s+/i, "") ||
  extractTokenFromCookie(req.headers.cookie);

const mapTokenError = (error) => {
  if (error?.name === "TokenExpiredError") {
    return {
      statusCode: 401,
      code: "SESSION_EXPIRED",
      message: "Your session has expired.",
      hint: "Please log in again.",
    };
  }

  if (error?.name === "NotBeforeError") {
    return {
      statusCode: 401,
      code: "TOKEN_NOT_ACTIVE",
      message: "Your session is not active yet.",
      hint: "Please wait a moment and try again.",
    };
  }

  return {
    statusCode: 401,
    code: "TOKEN_INVALID",
    message: "Authentication token is invalid.",
    hint: "Please log in again.",
  };
};

async function ensureAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return sendError(req, res, {
        statusCode: 401,
        code: "TOKEN_MISSING",
        message: "Authentication token is missing.",
        hint: "Please log in again to continue.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_KEY);
    } catch (error) {
      return sendError(req, res, mapTokenError(error));
    }

    const user = await userRepository.getById(decoded.id);
    if (!user) {
      return sendError(req, res, {
        statusCode: 401,
        code: "USER_NOT_FOUND",
        message: "No active account was found for this session.",
        hint: "Please log in again. If the issue continues, contact a super admin.",
      });
    }

    const tokenPasswordVersion = decoded?.passwordVersion;
    const currentPasswordVersion = Number(user?.password_version || 0);
    if (
      (Number.isFinite(Number(tokenPasswordVersion)) &&
        Number(tokenPasswordVersion) !== currentPasswordVersion) ||
      (!Number.isFinite(Number(tokenPasswordVersion)) && currentPasswordVersion > 0)
    ) {
      return sendError(req, res, {
        statusCode: 401,
        code: "SESSION_REVOKED",
        message: "Your session is no longer valid.",
        hint: "Please log in again.",
      });
    }

    if (user.must_change_password) {
      return sendError(req, res, {
        statusCode: 403,
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Password change required before continuing.",
        hint: "Change your password before continuing.",
      });
    }

    req.user = {
      id: user.id,
      fullname: user.fullname,
      must_change_password: Boolean(user.must_change_password),
      roles: normalizeRoles(
        Array.isArray(user.roles) ? user.roles.map((role) => role.name) : [],
      ),
    };
    return next();
  } catch (_error) {
    return sendError(req, res, {
      statusCode: 401,
      code: "UNAUTHORIZED",
      message: "Unauthorized.",
      hint: "Please log in again to continue.",
    });
  }
}

function requireAnyRole(allowedRoles = []) {
  const normalizedAllowed = normalizeRoles(allowedRoles);
  return (req, res, next) => {
    const userRoles = normalizeRoles(req.user?.roles);
    const allowed = normalizedAllowed.some((role) => userRoles.includes(role));
    if (!allowed) {
      return sendError(req, res, {
        statusCode: 403,
        code: "ROLE_FORBIDDEN",
        message: "You do not have permission for this action.",
        hint: "Please use an account with the required role.",
      });
    }
    return next();
  };
}

const requireAdminOperations = requireAnyRole(["SUPER_ADMIN"]);

module.exports = {
  ensureAuth,
  requireAnyRole,
  requireAdminOperations,
};
