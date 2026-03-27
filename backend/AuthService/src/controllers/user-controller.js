const UserService = require("../services/user-service");
const {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  buildCookieOptions,
  clearSessionCookies,
  generateCsrfToken,
  parseCookies,
  setSessionCookies,
} = require("../utils/cookie-utils");

const userService = new UserService();
const extractToken = (req) =>
  req.headers["x-access-token"] ||
  (req.headers.authorization || "").replace(/^Bearer\s+/i, "") ||
  parseCookies(req.headers.cookie || "")[AUTH_COOKIE_NAME];

const create = async (req, res) => {
  try {
    const response = await userService.create({
      empcode: req.body.empcode,
      fullname: req.body.fullname,
      mobileno: req.body.mobileno,
      password: req.body.password,
      designation: req.body.designation,
      division: req.body.division,
    });
    return res.status(201).json({
      success: true,
      message: "Successfully created a new user",
      data: response,
      err: {},
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    return res.status(statusCode).json({
      message:
        statusCode >= 500 ? "Unable to create user" : error?.message || "Request failed",
      data: {},
      success: false,
      err: statusCode >= 500 ? {} : { message: error?.explanation || error?.message },
    });
  }
};

const listUsers = async (req, res) => {
  try {
    const response = await userService.listUsers(req.query || {});
    return res.status(200).json({
      success: true,
      message: "Successfully fetched users.",
      data: response,
      err: {},
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        Number(error?.statusCode || 500) >= 500
          ? "Unable to fetch users"
          : error?.message || "Request failed",
      data: {},
      success: false,
      err:
        Number(error?.statusCode || 500) >= 500
          ? {}
          : { message: error?.message },
    });
  }
};

const signIn = async (req, res) => {
  try {
    const response = await userService.signIn(
      req.body.mobileno,
      req.body.password
    );
    const csrfToken = generateCsrfToken();
    setSessionCookies(res, response.newJWT, csrfToken);

    return res.status(200).json({
      success: true,
      message: "Successfully Signed in",
      data: {
        fullName: response.fullName,
        roles: response.roles || [],
        csrfToken,
      },
      err: {},
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        Number(error?.statusCode || 500) >= 500
          ? "Sign-in failed"
          : error?.message || "Invalid credentials",
      data: {},
      success: false,
      err:
        Number(error?.statusCode || 500) >= 500
          ? {}
          : { message: error?.explanation || error?.message },
    });
  }
};

const signOut = async (_req, res) => {
  clearSessionCookies(res);
  return res.status(200).json({
    success: true,
    message: "Signed out successfully",
    data: {},
    err: {},
  });
};

const getCsrfToken = async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const token =
    String(cookies[CSRF_COOKIE_NAME] || "").trim() || generateCsrfToken();

  if (!cookies[CSRF_COOKIE_NAME]) {
    res.cookie(
      CSRF_COOKIE_NAME,
      token,
      buildCookieOptions({
        httpOnly: false,
        maxAge: Number(process.env.CSRF_COOKIE_MAX_AGE_MS || 24 * 60 * 60 * 1000),
      }),
    );
  }

  return res.status(200).json({
    success: true,
    message: "CSRF token ready",
    data: { csrfToken: token },
    err: {},
  });
};

const isAuthenticated = async (req, res) => {
  try {
    const token = extractToken(req);
    const response = await userService.isAuthenticated(token);
    return res.status(200).json({
      success: true,
      message: "User is authenticated and token is valid.",
      data: response,
      err: {},
    });
  } catch {
    return res.status(401).json({
      message: "Unauthorized",
      data: {},
      success: false,
      err: {},
    });
  }
};
const isAdmin = async (req, res) => {
  try {
    const response = await userService.isAdmin(req.body.id);
    return res.status(200).json({
      success: true,
      message: "Successfully fetched whether user is admin or not.",
      data: response,
      err: {},
    });
  } catch {
    return res.status(500).json({
      message: "Something went wrong while fetching isAdmin.",
      data: {},
      success: false,
      err: {},
    });
  }
};

const getRoles = async (req, res) => {
  try {
    const response = await userService.getUserRoles(req.params.userId);
    return res.status(200).json({
      success: true,
      message: "Successfully fetched user roles.",
      data: response,
      err: {},
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        Number(error?.statusCode || 500) >= 500
          ? "Unable to fetch user roles"
          : error?.message || "Request failed",
      data: {},
      success: false,
      err:
        Number(error?.statusCode || 500) >= 500
          ? {}
          : { message: error?.message },
    });
  }
};

const getLocationScopes = async (req, res) => {
  try {
    const response = await userService.getUserLocationScopes(req.params.userId);
    return res.status(200).json({
      success: true,
      message: "Successfully fetched user location scopes.",
      data: response,
      err: {},
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        Number(error?.statusCode || 500) >= 500
          ? "Unable to fetch user location scopes"
          : error?.message || "Request failed",
      data: {},
      success: false,
      err:
        Number(error?.statusCode || 500) >= 500
          ? {}
          : { message: error?.message },
    });
  }
};

const assignRole = async (req, res) => {
  try {
    const response = await userService.assignRole(
      req.params.userId,
      req.body?.roleName || req.body?.role_name,
    );
    return res.status(200).json({
      success: true,
      message: "Role assigned successfully.",
      data: response,
      err: {},
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        Number(error?.statusCode || 500) >= 500
          ? "Unable to assign role"
          : error?.message || "Request failed",
      data: {},
      success: false,
      err:
        Number(error?.statusCode || 500) >= 500
          ? {}
          : { message: error?.message },
    });
  }
};

const removeRole = async (req, res) => {
  try {
    const response = await userService.removeRole(
      req.params.userId,
      req.params.roleName,
    );
    return res.status(200).json({
      success: true,
      message: "Role removed successfully.",
      data: response,
      err: {},
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        Number(error?.statusCode || 500) >= 500
          ? "Unable to remove role"
          : error?.message || "Request failed",
      data: {},
      success: false,
      err:
        Number(error?.statusCode || 500) >= 500
          ? {}
          : { message: error?.message },
    });
  }
};

const assignLocationScope = async (req, res) => {
  try {
    const response = await userService.assignLocationScope(
      req.params.userId,
      req.body?.locationScope || req.body?.location_scope,
      {
        scopeLabel: req.body?.scopeLabel || req.body?.scope_label,
        actorUserId: req.user?.id || null,
      },
    );
    return res.status(200).json({
      success: true,
      message: "Location scope assigned successfully.",
      data: response,
      err: {},
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        Number(error?.statusCode || 500) >= 500
          ? "Unable to assign location scope"
          : error?.message || "Request failed",
      data: {},
      success: false,
      err:
        Number(error?.statusCode || 500) >= 500
          ? {}
          : { message: error?.message },
    });
  }
};

const removeLocationScope = async (req, res) => {
  try {
    const response = await userService.removeLocationScope(
      req.params.userId,
      req.params.locationScope,
      {
        actorUserId: req.user?.id || null,
      },
    );
    return res.status(200).json({
      success: true,
      message: "Location scope removed successfully.",
      data: response,
      err: {},
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        Number(error?.statusCode || 500) >= 500
          ? "Unable to remove location scope"
          : error?.message || "Request failed",
      data: {},
      success: false,
      err:
        Number(error?.statusCode || 500) >= 500
          ? {}
          : { message: error?.message },
    });
  }
};

const listRoles = async (_req, res) => {
  try {
    const response = await userService.listRoles();
    return res.status(200).json({
      success: true,
      message: "Successfully fetched roles.",
      data: response,
      err: {},
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message:
        Number(error?.statusCode || 500) >= 500
          ? "Unable to fetch roles"
          : error?.message || "Request failed",
      data: {},
      success: false,
      err:
        Number(error?.statusCode || 500) >= 500
          ? {}
          : { message: error?.message },
    });
  }
};

module.exports = {
  create,
  listUsers,
  getCsrfToken,
  signIn,
  signOut,
  isAuthenticated,
  isAdmin,
  getRoles,
  getLocationScopes,
  listRoles,
  assignRole,
  removeRole,
  assignLocationScope,
  removeLocationScope,
};
