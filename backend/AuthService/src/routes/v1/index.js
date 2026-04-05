const express = require("express");

const UserController = require("../../controllers/user-controller");
const { AuthRequestValidator } = require("../../middlewares/index");
const ApprovalController = require("../../controllers/approval-controller");
const ForensicAuditController = require("../../controllers/forensic-audit-controller");
const OrgAssignmentController = require("../../controllers/org-assignment-controller");
const {
  ensureAuth,
  requireAnyRole,
  requireAdminOperations,
} = require("../../middlewares/auth-middleware");
const {
  ensureInternalService,
} = require("../../middlewares/internal-service-middleware");
const {
  authSignInRateLimiter,
  authInternalProvisionRateLimiter,
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
  "/internal/users/provision-from-employee/validate",
  authInternalProvisionRateLimiter,
  ensureInternalService,
  UserController.validateProvisionFromEmployee,
);
router.post(
  "/internal/users/provision-from-employee/execute",
  authInternalProvisionRateLimiter,
  ensureInternalService,
  UserController.executeProvisionFromEmployee,
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
router.get("/session/status", UserController.getSessionStatus);

router.get(
  "/isAdmin",
  ensureAuth,
  requireAnyRole(["SUPER_ADMIN"]),
  AuthRequestValidator.validateIsAdminRequest,
  UserController.isAdmin
);

router.get("/users/isAuthenticated", UserController.isAuthenticated);
router.get(
  "/users",
  ensureAuth,
  requireAdminOperations,
  UserController.listUsers,
);
router.get(
  "/users/:userId/roles",
  ensureAuth,
  requireAdminOperations,
  UserController.getRoles,
);
router.get(
  "/users/:userId/location-scopes",
  ensureAuth,
  requireAdminOperations,
  UserController.getLocationScopes,
);
router.post(
  "/users/:userId/roles",
  ensureAuth,
  requireAdminOperations,
  UserController.assignRole,
);
router.post(
  "/users/:userId/location-scopes",
  ensureAuth,
  requireAdminOperations,
  UserController.assignLocationScope,
);
router.delete(
  "/users/:userId/roles/:roleName",
  ensureAuth,
  requireAdminOperations,
  UserController.removeRole,
);
router.delete(
  "/users/:userId/location-scopes/:locationScope",
  ensureAuth,
  requireAdminOperations,
  UserController.removeLocationScope,
);
router.get(
  "/roles",
  ensureAuth,
  requireAdminOperations,
  UserController.listRoles,
);

router.get(
  "/org-assignments",
  ensureAuth,
  requireAdminOperations,
  OrgAssignmentController.list,
);
router.post(
  "/org-assignments",
  ensureAuth,
  requireAdminOperations,
  OrgAssignmentController.assign,
);
router.patch(
  "/org-assignments/:assignmentId/end",
  ensureAuth,
  requireAdminOperations,
  OrgAssignmentController.end,
);

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
