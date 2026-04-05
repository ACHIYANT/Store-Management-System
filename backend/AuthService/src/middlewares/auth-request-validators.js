const validateUserAuth = (req, res, next) => {
  const mobileno = String(req.body?.mobileno || "").trim();
  const password = String(req.body?.password || "");

  if (!mobileno || !password) {
    return res.status(400).json({
      success: false,
      data: {},
      message: "Validation failed",
      err: "Mobile number or password is missing in the request",
    });
  }
  next();
};
const validateIsAdminRequest = (req, res, next) => {
  if(!req.body.id)
  {
    return res.status(400).json({
      success: false,
      data: {},
      message: "something went wrong",
      err: "User id not given.",
    });
  }
  next();
};

const validateFirstLoginPasswordChange = (req, res, next) => {
  const passwordChangeToken = String(req.body?.passwordChangeToken || "").trim();
  const newPassword = String(req.body?.newPassword || "");
  const confirmPassword = String(req.body?.confirmPassword || "");

  if (!passwordChangeToken || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      data: {},
      message: "Validation failed",
      err: {
        code: "PASSWORD_CHANGE_FIELDS_MISSING",
        message:
          "Password change token, new password, and confirm password are required.",
      },
    });
  }

  return next();
};

const validateAuthenticatedPasswordChange = (req, res, next) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  const confirmPassword = String(req.body?.confirmPassword || "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      success: false,
      data: {},
      message: "Validation failed",
      err: {
        code: "PASSWORD_CHANGE_FIELDS_MISSING",
        message:
          "Current password, new password, and confirm password are required.",
      },
    });
  }

  return next();
};

module.exports = {
  validateUserAuth,
  validateIsAdminRequest,
  validateFirstLoginPasswordChange,
  validateAuthenticatedPasswordChange,
};
