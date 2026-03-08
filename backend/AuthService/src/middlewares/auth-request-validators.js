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
}
module.exports = {
  validateUserAuth,
  validateIsAdminRequest
};
