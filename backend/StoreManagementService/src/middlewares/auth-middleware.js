const axios = require("axios");
const { AUTH_BASE_URL } = require("../config/serverConfig");
const { AUTH_COOKIE_NAME, parseCookies } = require("../utils/cookie-utils");

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

async function fetchCurrentUser(token) {
  const r = await axios.get(`${AUTH_BASE_URL}/users/isAuthenticated`, {
    headers: { "x-access-token": token },
    timeout: Number(process.env.AUTH_REQUEST_TIMEOUT_MS || 5000),
  });

  const me = r.data?.data || {};
  return {
    id: me.id,
    empcode: me.empcode,
    fullname: me.fullname,
    mobileno: me.mobileno,
    designation: me.designation,
    division: me.division,
    roles: normalizeRoleList(me.roles),
  };
}

async function ensureAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    req.user = await fetchCurrentUser(token);
    next();
  } catch (_error) {
    res.status(401).json({ success: false, message: "Unauthorized" });
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
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized user." });
    }

    if (!hasAnyRole(req.user.roles, allowedRoles)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden: insufficient role." });
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
