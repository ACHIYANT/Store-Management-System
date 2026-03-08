const jwt = require("jsonwebtoken");
const UserRepository = require("../repository/user-repository");
const { JWT_KEY } = require("../config/serverConfig");
const { AUTH_COOKIE_NAME, parseCookies } = require("../utils/cookie-utils");

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

async function ensureAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, JWT_KEY);
    const user = await userRepository.getById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.user = {
      id: user.id,
      fullname: user.fullname,
      roles: normalizeRoles(
        Array.isArray(user.roles) ? user.roles.map((role) => role.name) : [],
      ),
    };
    return next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

function requireAnyRole(allowedRoles = []) {
  const normalizedAllowed = normalizeRoles(allowedRoles);
  return (req, res, next) => {
    const userRoles = normalizeRoles(req.user?.roles);
    const allowed = normalizedAllowed.some((role) => userRoles.includes(role));
    if (!allowed) {
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
  requireAnyRole,
  requireAdminOperations,
};
