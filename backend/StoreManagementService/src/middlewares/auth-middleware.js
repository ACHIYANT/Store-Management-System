const axios = require("axios");
const { AUTH_BASE_URL } = require("../config/serverConfig");
const { AUTH_COOKIE_NAME, parseCookies } = require("../utils/cookie-utils");
const { sendAuthError } = require("../utils/auth-response-utils");
const {
  collectActorLocationScopes,
  normalizeLocationScope,
} = require("../utils/location-scope");
const { Employee } = require("../models");

const normalizeRoleList = (roles) =>
  Array.isArray(roles)
    ? roles.map((role) => String(role || "").toUpperCase()).filter(Boolean)
    : [];

const extractTokenFromCookie = (cookieHeader = "") =>
  parseCookies(cookieHeader)[AUTH_COOKIE_NAME] || "";

const extractToken = (req) =>
  req.headers["x-access-token"] ||
  (req.headers.authorization || "").replace(/^Bearer\s+/i, "") ||
  extractTokenFromCookie(req.headers.cookie);

async function resolveEmployeeLocationScope(empcode) {
  const numericEmpcode = Number(empcode);
  if (!Number.isFinite(numericEmpcode) || numericEmpcode <= 0) return null;

  const employee = await Employee.findByPk(numericEmpcode, {
    attributes: ["emp_id", "office_location"],
  });

  return normalizeLocationScope(employee?.office_location || null);
}

async function withFallbackLocationScopes(user = {}) {
  const explicitLocationScopes = Array.isArray(user?.location_scopes)
    ? user.location_scopes
        .map((scope) => normalizeLocationScope(scope))
        .filter(Boolean)
    : [];

  const baseUser = {
    ...user,
    location_scopes: explicitLocationScopes,
    location_scope_source: explicitLocationScopes.length
      ? "explicit"
      : user?.location_scope_source || null,
  };

  if (normalizeRoleList(baseUser.roles).includes("SUPER_ADMIN")) {
    return baseUser;
  }

  if (baseUser.location_scopes.length > 0) {
    return baseUser;
  }

  const access = collectActorLocationScopes(baseUser);
  if (access.scopes.length > 0 && !baseUser.location_scopes.length) {
    const assignmentScopedUser = {
      ...baseUser,
      location_scopes: access.scopes,
      location_scope_source: "assignment",
    };
    if (access.unrestricted) {
      return assignmentScopedUser;
    }
    return assignmentScopedUser;
  }

  if (access.unrestricted) {
    return baseUser;
  }

  const employeeLocationScope = await resolveEmployeeLocationScope(
    baseUser.empcode,
  );
  if (!employeeLocationScope) {
    return baseUser;
  }

  return {
    ...baseUser,
    office_location_scope: employeeLocationScope,
    location_scopes: [employeeLocationScope],
    location_scope_source: "employee",
  };
}

async function fetchCurrentUser(token, requestId) {
  const r = await axios.get(`${AUTH_BASE_URL}/users/isAuthenticated`, {
    headers: {
      "x-access-token": token,
      "x-request-id": String(requestId || "").trim() || undefined,
    },
    timeout: Number(process.env.AUTH_REQUEST_TIMEOUT_MS || 5000),
  });

  const me = r.data?.data || {};
  return withFallbackLocationScopes({
    id: me.id,
    empcode: me.empcode,
    fullname: me.fullname,
    mobileno: me.mobileno,
    designation: me.designation,
    division: me.division,
    roles: normalizeRoleList(me.roles),
    assignments: Array.isArray(me.assignments) ? me.assignments : [],
    location_scopes: Array.isArray(me.location_scopes) ? me.location_scopes : [],
    location_scope_source: me.location_scope_source || null,
  });
}

function mapAuthServiceError(error) {
  const statusCode = Number(error?.response?.status || 0);
  const payload = error?.response?.data || {};
  const upstreamRequestId =
    error?.response?.headers?.["x-request-id"] || payload?.requestId || null;

  if (statusCode === 401 || statusCode === 403) {
    return {
      statusCode,
      code:
        String(payload?.code || payload?.err?.code || "").trim() ||
        (statusCode === 403 ? "ROLE_FORBIDDEN" : "UNAUTHORIZED"),
      message:
        String(payload?.message || payload?.err?.message || "").trim() ||
        (statusCode === 403
          ? "You do not have permission for this action."
          : "Unauthorized."),
      hint: String(payload?.hint || "").trim() || "",
      upstreamRequestId,
    };
  }

  if (error?.code === "ECONNABORTED") {
    return {
      statusCode: 503,
      code: "AUTH_SERVICE_TIMEOUT",
      message: "Authentication check timed out.",
      hint: "Please try again in a moment.",
      upstreamRequestId,
    };
  }

  return {
    statusCode: 503,
    code: "AUTH_SERVICE_UNREACHABLE",
    message: "Authentication check could not be completed.",
    hint: "Please try again in a moment.",
    upstreamRequestId,
  };
}

async function ensureAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token)
      return sendAuthError(req, res, {
        statusCode: 401,
        code: "TOKEN_MISSING",
        message: "Authentication token is missing.",
        hint: "Please log in again to continue.",
      });

    req.user = await fetchCurrentUser(token, req.requestId);
    next();
  } catch (error) {
    return sendAuthError(req, res, mapAuthServiceError(error));
  }
}

async function ensureAuthOptional(req, _res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = await fetchCurrentUser(token);
    return next();
  } catch {
    req.user = null;
    return next();
  }
}

function hasAnyRole(userRoles = [], allowedRoles = []) {
  const userSet = new Set(normalizeRoleList(userRoles));
  return normalizeRoleList(allowedRoles).some((role) => userSet.has(role));
}

function requireAnyRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user?.id) {
      return sendAuthError(req, res, {
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "Unauthorized user.",
        hint: "Please log in again to continue.",
      });
    }

    if (!hasAnyRole(req.user.roles, allowedRoles)) {
      return sendAuthError(req, res, {
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
  ensureAuthOptional,
  hasAnyRole,
  requireAnyRole,
  requireAdminOperations,
};
