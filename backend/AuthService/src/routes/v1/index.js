const express = require("express");

const UserController = require("../../controllers/user-controller");
const { AuthRequestValidator } = require("../../middlewares/index");
const ApprovalController = require("../../controllers/approval-controller");
const ForensicAuditController = require("../../controllers/forensic-audit-controller");
const {
  ensureAuth,
  requireAnyRole,
  requireAdminOperations,
} = require("../../middlewares/auth-middleware");
const {
  authSignInRateLimiter,
} = require("../../middlewares/security-middleware");

const router = express.Router();

router.get("/healthz", (_req, res) =>
  res.status(200).json({
    success: true,
    message: "Auth service healthy",
    data: { uptime: process.uptime() },
    err: {},
  }),
);

router.post(
  "/signup",
  authSignInRateLimiter,
  AuthRequestValidator.validateUserAuth,
  UserController.create
);
router.post(
  "/signin",
  authSignInRateLimiter,
  AuthRequestValidator.validateUserAuth,
  UserController.signIn
);
router.post("/signout", UserController.signOut);
router.get("/csrf-token", UserController.getCsrfToken);
router.get("/isAuthenticated", UserController.isAuthenticated);

router.get(
  "/isAdmin",
  ensureAuth,
  requireAnyRole(["SUPER_ADMIN"]),
  AuthRequestValidator.validateIsAdminRequest,
  UserController.isAdmin
);

router.get("/users/isAuthenticated", UserController.isAuthenticated);

router.get("/approval/stages", ApprovalController.getApprovalStages);
router.post(
  "/",
  ensureAuth,
  requireAdminOperations,
  ApprovalController.addApprovalStage,
);
router.patch(
  "/:stageId/deactivate",
  ensureAuth,
  requireAdminOperations,
  ApprovalController.deactivateApprovalStage
);

router.get(
  "/forensic-audit/logs",
  ensureAuth,
  requireAdminOperations,
  ForensicAuditController.listLogs,
);
router.get(
  "/forensic-audit/archives",
  ensureAuth,
  requireAdminOperations,
  ForensicAuditController.listArchives,
);
router.post(
  "/forensic-audit/maintenance/run",
  ensureAuth,
  requireAdminOperations,
  ForensicAuditController.runMaintenance,
);

module.exports = router;
