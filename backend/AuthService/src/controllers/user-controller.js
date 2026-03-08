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
module.exports = {
  create,
  getCsrfToken,
  signIn,
  signOut,
  isAuthenticated,
  isAdmin,
};
