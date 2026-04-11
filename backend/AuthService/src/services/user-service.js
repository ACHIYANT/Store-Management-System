const UserRepository = require("../repository/user-repository");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const {
  EMPLOYEE_PROVISION_DEFAULT_PASSWORD,
  JWT_KEY,
  PASSWORD_CHANGE_JWT_KEY,
  PASSWORD_CHANGE_TOKEN_TTL,
  STORE_BASE_URL,
  STORE_INTERNAL_SERVICE_KEY,
  STORE_INTERNAL_SERVICE_NAME,
  STORE_VERIFICATION_REQUEST_TIMEOUT_MS,
} = require("../config/serverConfig");
const bcrypt = require("bcrypt");
const { isAssignmentManagedRole } = require("../constants/org-assignments");
const { normalizeDivisionValue } = require("../utils/division-utils");
const {
  PASSWORD_POLICY_HINT,
  PASSWORD_POLICY_MESSAGE,
  isPasswordPolicyCompliant,
} = require("../utils/password-policy");

const DEFAULT_SIGNUP_ROLE = "USER";

const buildAuthError = ({
  statusCode = 401,
  code = "UNAUTHORIZED",
  message = "Unauthorized.",
  explanation = "",
  hint = "",
  details = [],
  data = {},
} = {}) => ({
  statusCode,
  code,
  message,
  explanation,
  hint,
  details,
  data,
});

const serializeLocationScopes = (locationScopes = []) => {
  if (!Array.isArray(locationScopes)) return [];

  const byScope = new Map();
  for (const scope of locationScopes) {
    const normalizedScope = String(scope?.location_scope || "")
      .trim()
      .toUpperCase();
    if (!normalizedScope || byScope.has(normalizedScope)) continue;
    byScope.set(normalizedScope, {
      id: scope.id,
      location_scope: normalizedScope,
      scope_label: scope.scope_label || null,
      effective_from: scope.effective_from || null,
    });
  }

  return [...byScope.values()].sort((a, b) =>
    String(a.scope_label || a.location_scope).localeCompare(
      String(b.scope_label || b.location_scope),
    ),
  );
};

const serializeLocationScopeKeys = (locationScopes = []) =>
  serializeLocationScopes(locationScopes).map((scope) => scope.location_scope);

const serializeAssignments = (assignments = []) =>
  Array.isArray(assignments)
    ? [...new Map(
        assignments
          .filter((assignment) => assignment?.id != null)
          .map((assignment) => [
            assignment.id,
            {
              id: assignment.id,
              assignment_type: assignment.assignment_type,
              scope_type: assignment.scope_type,
              scope_key: assignment.scope_key,
              scope_label: assignment.scope_label || null,
              effective_from: assignment.effective_from || null,
              metadata_json: assignment.metadata_json || null,
              notes: assignment.notes || null,
            },
          ]),
      ).values()]
    : [];

const serializeRoles = (roles = []) => {
  if (!Array.isArray(roles)) return [];
  const byName = new Map();
  for (const role of roles) {
    const name = String(role?.name || "").trim();
    if (!name || byName.has(name)) continue;
    byName.set(name, {
      id: role.id,
      name,
    });
  }

  return [...byName.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name)),
  );
};

const serializeUserSummary = (user) => ({
  id: user.id,
  empcode: user.empcode,
  fullname: user.fullname,
  mobileno: user.mobileno,
  designation: user.designation,
  division: user.division,
  must_change_password: Boolean(user.must_change_password),
  password_changed_at: user.password_changed_at || null,
  roles: serializeRoles(user.roles),
  location_scopes: serializeLocationScopes(user.userLocationScopes),
  assignments: serializeAssignments(user.orgAssignments),
});

const normalizeLocationScopeKey = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const STORE_STAGE_STATUSES = new Set([
  "Approved",
  "PartiallyApproved",
  "Fulfilling",
]);

const serializePendingHolderUser = (user = {}) => ({
  id: user.id,
  empcode: user.empcode,
  fullname: user.fullname,
  mobileno: user.mobileno,
  designation: user.designation || null,
  division: user.division || null,
});

const buildUniqueUsers = (users = []) => {
  const byId = new Map();
  for (const user of users) {
    const id = Number(user?.id);
    if (!Number.isFinite(id) || byId.has(id)) continue;
    byId.set(id, serializePendingHolderUser(user));
  }
  return [...byId.values()].sort((left, right) => {
    const byName = String(left?.fullname || "").localeCompare(
      String(right?.fullname || ""),
      "en",
      { sensitivity: "base" },
    );
    if (byName !== 0) return byName;
    return Number(left?.id || 0) - Number(right?.id || 0);
  });
};

const normalizeText = (value) => {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text || "";
};

const eqText = (a, b) =>
  normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase();

const withTimeout = (promise, timeoutMs, errorFactory) => {
  if (!Number.isFinite(Number(timeoutMs)) || Number(timeoutMs) <= 0) {
    return promise;
  }
  const ms = Number(timeoutMs);
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(errorFactory()), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};

const invalidCredentialsError = () => ({
  statusCode: 401,
  code: "INVALID_CREDENTIALS",
  message: "Invalid credentials",
  explanation: "Mobile number or password is incorrect.",
  hint: "Please check your mobile number and password and try again.",
});

const authTimeoutError = () => ({
  statusCode: 503,
  code: "AUTH_SERVICE_TIMEOUT",
  message: "Authentication service timeout",
  explanation:
    "Unable to complete authentication right now. Please try again in a moment.",
  hint: "Please try again in a moment.",
});

const publicSignupDisabledError = () =>
  buildAuthError({
    statusCode: 403,
    code: "PUBLIC_SIGNUP_DISABLED",
    message: "Public signup is not available.",
    explanation:
      "This system uses employee account activation instead of open self-registration.",
    hint: "Use the activate account flow to claim access with your employee details.",
  });

const storeVerificationNotConfiguredError = () =>
  buildAuthError({
    statusCode: 503,
    code: "STORE_VERIFICATION_NOT_CONFIGURED",
    message: "Employee verification is not configured.",
    explanation:
      "The authentication service is missing the Store verification endpoint configuration.",
    hint: "Please contact a super admin to complete the service configuration.",
  });

const storeVerificationFailedError = ({
  message = "This account is not eligible for Store sign-in yet.",
  hint = "Please contact the administrator to complete employee onboarding.",
  details = [],
  upstreamRequestId = null,
} = {}) =>
  buildAuthError({
    statusCode: 403,
    code: "STORE_EMPLOYEE_VERIFICATION_FAILED",
    message,
    hint,
    details,
    data: upstreamRequestId ? { upstreamRequestId } : {},
  });

const PASSWORD_CHANGE_TOKEN_PURPOSE = "PASSWORD_CHANGE";

const sessionRevokedError = () =>
  buildAuthError({
    statusCode: 401,
    code: "SESSION_REVOKED",
    message: "Your session is no longer valid.",
    explanation: "The account password has changed since this session was created.",
    hint: "Please log in again.",
  });

const passwordChangeRequiredError = (data = {}) =>
  buildAuthError({
    statusCode: 403,
    code: "PASSWORD_CHANGE_REQUIRED",
    message: "Password change required before continuing.",
    explanation: "This account must set a new password before a normal session can be used.",
    hint: "Change your password to activate the account.",
    data,
  });

const passwordChangeTokenError = (code, message, hint) =>
  buildAuthError({
    statusCode: 401,
    code,
    message,
    hint,
  });

const passwordValidationError = ({
  code,
  message,
  hint,
  details = [],
  statusCode = 400,
}) =>
  buildAuthError({
    statusCode,
    code,
    message,
    hint,
    details,
  });

const getRoleNames = (user) =>
  Array.isArray(user?.roles) ? user.roles.map((role) => role.name) : [];

const getDecodedTokenLifetime = (token) => {
  const decoded = jwt.decode(token) || {};
  const issuedAt = Number(decoded?.iat || 0);
  const expiresAt = Number(decoded?.exp || 0);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) {
    return null;
  }
  return expiresAt - issuedAt;
};

const tokenMissingError = () =>
  buildAuthError({
    statusCode: 401,
    code: "TOKEN_MISSING",
    message: "Authentication token is missing.",
    explanation: "The request did not include a valid login session.",
    hint: "Please log in again to continue.",
  });

const userNotFoundForTokenError = () =>
  buildAuthError({
    statusCode: 401,
    code: "USER_NOT_FOUND",
    message: "No active account was found for this session.",
    explanation: "The user linked to this session could not be loaded.",
    hint: "Please log in again. If the issue continues, contact a super admin.",
  });

const mapTokenVerificationError = (error) => {
  if (!error) {
    return buildAuthError({
      statusCode: 401,
      code: "TOKEN_INVALID",
      message: "Authentication token is invalid.",
      explanation: "The login token could not be verified.",
      hint: "Please log in again.",
    });
  }

  if (error.name === "TokenExpiredError") {
    return buildAuthError({
      statusCode: 401,
      code: "SESSION_EXPIRED",
      message: "Your session has expired.",
      explanation: "The login session is no longer valid.",
      hint: "Please log in again.",
    });
  }

  if (error.name === "NotBeforeError") {
    return buildAuthError({
      statusCode: 401,
      code: "TOKEN_NOT_ACTIVE",
      message: "Your session is not active yet.",
      explanation: "The login token cannot be used yet.",
      hint: "Please wait a moment and try again.",
    });
  }

  return buildAuthError({
    statusCode: 401,
    code: "TOKEN_INVALID",
    message: "Authentication token is invalid.",
    explanation: error.message || "The login token could not be verified.",
    hint: "Please log in again.",
  });
};

class UserService {
  constructor() {
    this.UserRepository = new UserRepository();
  }

  resolveExistingActivationState(user) {
    return Boolean(user?.must_change_password) ? "provisioned" : "active";
  }

  buildSessionPayload(user) {
    const roles = getRoleNames(user);
    return {
      newJWT: this.createToken({
        mobileno: user.mobileno,
        id: user.id,
        roles,
        passwordVersion: Number(user.password_version || 0),
      }),
      fullName: user.fullname,
      roles,
      mustChangePassword: Boolean(user.must_change_password),
    };
  }

  createPasswordChangeToken(user) {
    const signingKey = String(PASSWORD_CHANGE_JWT_KEY || JWT_KEY || "").trim();
    if (!signingKey || signingKey.length < 32) {
      throw new Error("PASSWORD_CHANGE_JWT_KEY or JWT_KEY is missing or too weak.");
    }

    return jwt.sign(
      {
        id: user.id,
        empcode: user.empcode,
        purpose: PASSWORD_CHANGE_TOKEN_PURPOSE,
        passwordVersion: Number(user.password_version || 0),
      },
      signingKey,
      {
        expiresIn: PASSWORD_CHANGE_TOKEN_TTL,
        subject: String(user.id),
      },
    );
  }

  verifyPasswordChangeToken(token) {
    const normalizedToken = String(token || "").trim();
    if (!normalizedToken) {
      throw passwordChangeTokenError(
        "PASSWORD_CHANGE_TOKEN_INVALID",
        "Password change token is invalid.",
        "Start the sign-in process again to get a fresh password change link.",
      );
    }

    try {
      const decoded = jwt.verify(
        normalizedToken,
        String(PASSWORD_CHANGE_JWT_KEY || JWT_KEY || "").trim(),
      );
      if (decoded?.purpose !== PASSWORD_CHANGE_TOKEN_PURPOSE) {
        throw passwordChangeTokenError(
          "PASSWORD_CHANGE_TOKEN_INVALID",
          "Password change token is invalid.",
          "Start the sign-in process again to get a fresh password change link.",
        );
      }
      return decoded;
    } catch (error) {
      if (error?.statusCode) {
        throw error;
      }
      if (error?.name === "TokenExpiredError") {
        throw passwordChangeTokenError(
          "PASSWORD_CHANGE_TOKEN_EXPIRED",
          "Password change token has expired.",
          "Sign in again with your current password to continue.",
        );
      }
      throw passwordChangeTokenError(
        "PASSWORD_CHANGE_TOKEN_INVALID",
        "Password change token is invalid.",
        "Start the sign-in process again to get a fresh password change link.",
      );
    }
  }

  buildPasswordChangeRequiredPayload(user) {
    const passwordChangeToken = this.createPasswordChangeToken(user);
    return {
      fullName: user.fullname,
      empcode: user.empcode,
      passwordChangeToken,
      expiresInSeconds: getDecodedTokenLifetime(passwordChangeToken),
    };
  }

  buildEmployeeUserPayload(
    data = {},
    {
      password = "",
      mustChangePassword = false,
      includePassword = false,
      passwordChangedAt = null,
    } = {},
  ) {
    const payload = {
      empcode: Number(data?.empcode ?? data?.emp_id),
      fullname: normalizeText(data?.fullname ?? data?.name),
      mobileno: normalizeText(data?.mobileno ?? data?.mobile_no),
      designation: normalizeText(data?.designation),
      division: normalizeText(data?.division),
      must_change_password: Boolean(mustChangePassword),
    };

    if (includePassword) {
      payload.password = String(password || "");
    }
    if (passwordChangedAt) {
      payload.password_changed_at = passwordChangedAt;
    }

    return payload;
  }

  collectEmployeeUserPayloadValidationErrors(
    payload = {},
    { requirePassword = false } = {},
  ) {
    const validationErrors = [];

    if (!Number.isInteger(payload.empcode) || payload.empcode <= 0) {
      validationErrors.push("empcode must be a positive integer.");
    }
    if (!payload.fullname) validationErrors.push("fullname is required.");
    if (!payload.mobileno) validationErrors.push("mobileno is required.");
    if (!payload.designation) validationErrors.push("designation is required.");
    if (!payload.division) validationErrors.push("division is required.");
    if (requirePassword && !String(payload.password || "").trim()) {
      validationErrors.push("password is required.");
    }

    return validationErrors;
  }

  async previewEmployeeUserPayload(
    payload = {},
    context = {},
    {
      createAction = "create",
      existingAction = "already_exists",
      existingState = "already_exists",
      conflictCode = "USER_ALREADY_EXISTS_CONFLICT",
      conflictMessage = (empcode) =>
        `User already exists for empcode ${empcode} with different details.`,
      conflictHint = "Review the existing Auth account before retrying.",
      mustChangePassword = false,
    } = {},
  ) {
    const validationErrors = this.collectEmployeeUserPayloadValidationErrors(payload, {
      requirePassword: false,
    });

    if (validationErrors.length) {
      throw buildAuthError({
        statusCode: 400,
        code: "INVALID_EMPLOYEE_USER_PAYLOAD",
        message: "Employee account payload is invalid.",
        hint: "Send complete employee details and try again.",
        details: validationErrors,
      });
    }

    const existingByEmpcode = await withTimeout(
      this.UserRepository.findByEmpcode(payload.empcode),
      Number(process.env.AUTH_DB_QUERY_TIMEOUT_MS || 10_000),
      authTimeoutError,
    );

    if (existingByEmpcode) {
      const mismatchDetails = [];
      if (!eqText(existingByEmpcode.fullname, payload.fullname)) {
        mismatchDetails.push(
          `fullname mismatch: Auth has '${existingByEmpcode.fullname}', request sent '${payload.fullname}'.`,
        );
      }
      if (!eqText(existingByEmpcode.mobileno, payload.mobileno)) {
        mismatchDetails.push(
          `mobileno mismatch: Auth has '${existingByEmpcode.mobileno}', request sent '${payload.mobileno}'.`,
        );
      }
      if (!eqText(existingByEmpcode.designation, payload.designation)) {
        mismatchDetails.push(
          `designation mismatch: Auth has '${existingByEmpcode.designation}', request sent '${payload.designation}'.`,
        );
      }
      if (!eqText(existingByEmpcode.division, payload.division)) {
        mismatchDetails.push(
          `division mismatch: Auth has '${existingByEmpcode.division}', request sent '${payload.division}'.`,
        );
      }

      if (mismatchDetails.length) {
        throw buildAuthError({
          statusCode: 409,
          code: conflictCode,
          message: conflictMessage(payload.empcode),
          hint: conflictHint,
          details: mismatchDetails,
        });
      }

      return {
        action: existingAction,
        activation_state: existingState,
        source_service: normalizeText(context?.serviceName) || null,
        user: {
          id: existingByEmpcode.id,
          empcode: existingByEmpcode.empcode,
          fullname: existingByEmpcode.fullname,
          mobileno: existingByEmpcode.mobileno,
          designation: existingByEmpcode.designation,
          division: existingByEmpcode.division,
          must_change_password: Boolean(existingByEmpcode.must_change_password),
        },
      };
    }

    const existingByMobile = await withTimeout(
      this.UserRepository.findByMobileNoOptional(payload.mobileno),
      Number(process.env.AUTH_DB_QUERY_TIMEOUT_MS || 10_000),
      authTimeoutError,
    );

    if (
      existingByMobile &&
      Number(existingByMobile.empcode) !== Number(payload.empcode)
    ) {
      throw buildAuthError({
        statusCode: 409,
        code: "MOBILE_ALREADY_IN_USE",
        message: `Mobile number ${payload.mobileno} already belongs to another user.`,
        hint: "Use a different mobile number or fix the existing Auth account before retrying.",
      });
    }

    return {
      action: createAction,
      activation_state: mustChangePassword ? "provisioned" : "ready",
      source_service: normalizeText(context?.serviceName) || null,
      user: {
        id: null,
        empcode: payload.empcode,
        fullname: payload.fullname,
        mobileno: payload.mobileno,
        designation: payload.designation,
        division: payload.division,
        must_change_password: Boolean(mustChangePassword),
      },
    };
  }

  shouldBypassStoreEmployeeVerification(user) {
    return getRoleNames(user).some(
      (roleName) => String(roleName || "").trim().toUpperCase() === "SUPER_ADMIN",
    );
  }

  async verifyStoreEmployeeLoginEligibility(user) {
    if (!user || this.shouldBypassStoreEmployeeVerification(user)) {
      return { allowed: true, bypassed: true };
    }

    const storeBaseUrl = String(STORE_BASE_URL || "").trim().replace(/\/+$/, "");
    const internalKey = String(STORE_INTERNAL_SERVICE_KEY || "").trim();
    const serviceName = String(STORE_INTERNAL_SERVICE_NAME || "").trim();

    if (!storeBaseUrl || !internalKey || !serviceName) {
      throw storeVerificationNotConfiguredError();
    }

    try {
      const response = await axios.post(
        `${storeBaseUrl}/internal/account-activation/verify-login-eligibility`,
        {
          empcode: user.empcode,
        },
        {
          headers: {
            "x-internal-service-key": internalKey,
            "x-internal-service-name": serviceName,
          },
          timeout: Number(STORE_VERIFICATION_REQUEST_TIMEOUT_MS || 5000),
        },
      );

      return response?.data?.data || { allowed: true };
    } catch (error) {
      const payload = error?.response?.data || {};
      const upstreamRequestId =
        String(error?.response?.headers?.["x-request-id"] || payload?.requestId || "").trim() ||
        null;

      if (error?.response) {
        throw storeVerificationFailedError({
          message:
            String(payload?.message || payload?.err?.message || "").trim() ||
            "This account is not eligible for Store sign-in yet.",
          hint:
            String(payload?.hint || "").trim() ||
            "Please contact the administrator to complete employee onboarding.",
          details: Array.isArray(payload?.details) ? payload.details : [],
          upstreamRequestId,
        });
      }

      if (error?.code === "ECONNABORTED") {
        throw buildAuthError({
          statusCode: 503,
          code: "STORE_VERIFICATION_TIMEOUT",
          message: "Employee verification timed out.",
          hint: "Please try again in a moment.",
        });
      }

      throw buildAuthError({
        statusCode: 503,
        code: "STORE_VERIFICATION_UNREACHABLE",
        message: "Employee verification could not be completed.",
        hint: "Please try again in a moment.",
      });
    }
  }

  ensureSessionStillValidForPasswordVersion(user, decodedToken = {}) {
    const tokenPasswordVersion = decodedToken?.passwordVersion;
    const currentPasswordVersion = Number(user?.password_version || 0);
    if (!Number.isFinite(Number(tokenPasswordVersion))) {
      if (currentPasswordVersion > 0) {
        throw sessionRevokedError();
      }
      return;
    }

    if (Number(tokenPasswordVersion) !== currentPasswordVersion) {
      throw sessionRevokedError();
    }
  }

  validateNewPasswordInput(user, { currentPassword = "", newPassword = "", confirmPassword = "" } = {}) {
    if (!String(newPassword || "")) {
      throw passwordValidationError({
        code: "NEW_PASSWORD_REQUIRED",
        message: "New password is required.",
        hint: "Enter a strong new password to continue.",
      });
    }

    if (!String(confirmPassword || "")) {
      throw passwordValidationError({
        code: "PASSWORD_CONFIRMATION_REQUIRED",
        message: "Confirm password is required.",
        hint: "Re-enter the new password to continue.",
      });
    }

    if (String(newPassword) !== String(confirmPassword)) {
      throw passwordValidationError({
        code: "PASSWORD_CONFIRMATION_MISMATCH",
        message: "New password and confirm password do not match.",
        hint: "Enter the same new password in both fields.",
      });
    }

    const defaultPassword = String(EMPLOYEE_PROVISION_DEFAULT_PASSWORD || "").trim();
    if (defaultPassword && String(newPassword) === defaultPassword) {
      throw passwordValidationError({
        code: "PASSWORD_REUSE_FORBIDDEN",
        message: "You cannot continue with the default provisioning password.",
        hint: "Choose a different password to activate the account.",
      });
    }

    if (user?.password && this.checkPassword(String(newPassword), user.password)) {
      throw passwordValidationError({
        code: "PASSWORD_REUSE_FORBIDDEN",
        message: "New password must be different from the current password.",
        hint: "Choose a different password to continue.",
      });
    }

    if (
      String(currentPassword || "") &&
      user?.password &&
      String(currentPassword) === String(newPassword)
    ) {
      throw passwordValidationError({
        code: "PASSWORD_REUSE_FORBIDDEN",
        message: "New password must be different from the current password.",
        hint: "Choose a different password to continue.",
      });
    }

    if (!isPasswordPolicyCompliant(newPassword)) {
      throw passwordValidationError({
        code: "INVALID_NEW_PASSWORD",
        message: "New password does not meet the required policy.",
        hint: PASSWORD_POLICY_HINT,
        details: [PASSWORD_POLICY_MESSAGE],
      });
    }
  }

  async updatePasswordForUser(userId, { currentPassword = "", newPassword = "", confirmPassword = "" } = {}) {
    const user = await withTimeout(
      this.UserRepository.getPasswordManagedUserById(userId),
      Number(process.env.AUTH_DB_QUERY_TIMEOUT_MS || 10_000),
      authTimeoutError,
    );

    if (!user) {
      throw buildAuthError({
        statusCode: 404,
        code: "USER_NOT_FOUND",
        message: "User not found.",
        hint: "Please sign in again and retry.",
      });
    }

    if (!this.checkPassword(String(currentPassword || ""), user.password)) {
      throw passwordValidationError({
        code: "CURRENT_PASSWORD_INCORRECT",
        message: "Current password is incorrect.",
        hint: "Please enter your current password correctly.",
      });
    }

    this.validateNewPasswordInput(user, {
      currentPassword,
      newPassword,
      confirmPassword,
    });

    try {
      const updatedUser = await withTimeout(
        this.UserRepository.updatePasswordForUser(user.id, {
          newPassword,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          incrementPasswordVersion: true,
        }),
        Number(process.env.AUTH_DB_QUERY_TIMEOUT_MS || 10_000),
        authTimeoutError,
      );

      return {
        ...this.buildSessionPayload(updatedUser),
        passwordChangedAt: updatedUser.password_changed_at,
      };
    } catch (error) {
      if (error?.statusCode) throw error;
      if (error?.name === "SequelizeValidationError") {
        throw passwordValidationError({
          code: "INVALID_NEW_PASSWORD",
          message: "New password does not meet the required policy.",
          hint: "Use at least 8 characters with uppercase, lowercase, number, and special character.",
          details: Array.isArray(error?.errors)
            ? error.errors
                .map((entry) => String(entry?.message || "").trim())
                .filter(Boolean)
            : [],
        });
      }
      throw buildAuthError({
        statusCode: 500,
        code: "PASSWORD_UPDATE_FAILED",
        message: "Unable to update password.",
        hint: "Please try again in a moment.",
      });
    }
  }

  async completeFirstLoginPasswordChange(passwordChangeToken, { newPassword = "", confirmPassword = "" } = {}) {
    const decoded = this.verifyPasswordChangeToken(passwordChangeToken);
    const user = await withTimeout(
      this.UserRepository.getPasswordManagedUserById(decoded?.id),
      Number(process.env.AUTH_DB_QUERY_TIMEOUT_MS || 10_000),
      authTimeoutError,
    );

    if (!user) {
      throw userNotFoundForTokenError();
    }

    if (!user.must_change_password) {
      throw buildAuthError({
        statusCode: 409,
        code: "PASSWORD_CHANGE_NOT_REQUIRED",
        message: "Password change is no longer required for this account.",
        hint: "Please sign in with your updated password.",
      });
    }

    if (Number(decoded?.passwordVersion) !== Number(user.password_version || 0)) {
      throw passwordChangeTokenError(
        "PASSWORD_CHANGE_TOKEN_INVALID",
        "Password change token is no longer valid.",
        "Sign in again with your current password to continue.",
      );
    }

    this.validateNewPasswordInput(user, { newPassword, confirmPassword });

    try {
      const updatedUser = await withTimeout(
        this.UserRepository.updatePasswordForUser(user.id, {
          newPassword,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          incrementPasswordVersion: true,
        }),
        Number(process.env.AUTH_DB_QUERY_TIMEOUT_MS || 10_000),
        authTimeoutError,
      );

      return {
        fullName: updatedUser.fullname,
        mustChangePassword: Boolean(updatedUser.must_change_password),
        passwordChangedAt: updatedUser.password_changed_at,
      };
    } catch (error) {
      if (error?.statusCode) throw error;
      if (error?.name === "SequelizeValidationError") {
        throw passwordValidationError({
          code: "INVALID_NEW_PASSWORD",
          message: "New password does not meet the required policy.",
          hint: "Use at least 8 characters with uppercase, lowercase, number, and special character.",
          details: Array.isArray(error?.errors)
            ? error.errors
                .map((entry) => String(entry?.message || "").trim())
                .filter(Boolean)
            : [],
        });
      }
      throw buildAuthError({
        statusCode: 500,
        code: "PASSWORD_UPDATE_FAILED",
        message: "Unable to update password.",
        hint: "Please try again in a moment.",
      });
    }
  }

  async create(data) {
    try {
      const user = await this.UserRepository.create(data);
      return {
        id: user.id,
        empcode: user.empcode,
        fullname: user.fullname,
        mobileno: user.mobileno,
        designation: user.designation,
        division: user.division,
        roles: [DEFAULT_SIGNUP_ROLE],
        location_scopes: [],
      };
    } catch (error) {
      if (error.name === "SequelizeValidationError") {
        throw error;
      }
      throw {
        statusCode: 500,
        message: "Unable to create user",
        explanation: "Something went wrong while creating user.",
      };
    }
  }

  rejectPublicSignup() {
    throw publicSignupDisabledError();
  }

  async provisionFromEmployee(data = {}, context = {}) {
    const payload = this.buildEmployeeUserPayload(data, {
      password: String(EMPLOYEE_PROVISION_DEFAULT_PASSWORD || "").trim(),
      mustChangePassword: true,
      includePassword: true,
    });

    const validationErrors = this.collectEmployeeUserPayloadValidationErrors(payload, {
      requirePassword: true,
    });
    if (validationErrors.length) {
      throw buildAuthError({
        statusCode: 400,
        code: "INVALID_PROVISION_PAYLOAD",
        message: "Employee provisioning payload is invalid.",
        hint: "Send complete employee details and ensure the default provisioning password is configured.",
        details: validationErrors,
      });
    }

    return this._provisionFromEmployeePayload(payload, context);
  }

  async previewProvisionFromEmployee(data = {}, context = {}) {
    const payload = this.buildEmployeeUserPayload(data, {
      mustChangePassword: true,
    });

    const preview = await this.previewEmployeeUserPayload(payload, context, {
      createAction: "create",
      existingAction: "already_exists",
      existingState: "provisioned",
      conflictCode: "USER_ALREADY_EXISTS_CONFLICT",
      conflictMessage: (empcode) =>
        `User already exists for empcode ${empcode} with different details.`,
      conflictHint: "Review the existing Auth account before retrying provisioning.",
      mustChangePassword: true,
    });

    if (preview.action === "already_exists") {
      preview.activation_state = this.resolveExistingActivationState(preview.user);
    }

    return preview;
  }

  async previewActivationFromEmployee(data = {}, context = {}) {
    const payload = this.buildEmployeeUserPayload(data, {
      mustChangePassword: false,
    });

    const preview = await this.previewEmployeeUserPayload(payload, context, {
      createAction: "activate",
      existingAction: "already_exists",
      existingState: "active",
      conflictCode: "ACCOUNT_ALREADY_EXISTS_CONFLICT",
      conflictMessage: (empcode) =>
        `Account already exists for empcode ${empcode} with different details.`,
      conflictHint: "Review the existing Auth account before retrying activation.",
      mustChangePassword: false,
    });

    if (preview.action === "already_exists") {
      preview.activation_state = this.resolveExistingActivationState(preview.user);
    }

    return preview;
  }

  async _provisionFromEmployeePayload(payload = {}, context = {}) {
    const preview = await this.previewProvisionFromEmployee(payload, context);
    if (preview.action === "already_exists") {
      return preview;
    }

    try {
      const createdUser = await this.UserRepository.create(payload);
      return {
        action: "created",
        source_service: normalizeText(context?.serviceName) || null,
        user: {
          id: createdUser.id,
          empcode: createdUser.empcode,
          fullname: createdUser.fullname,
          mobileno: createdUser.mobileno,
          designation: createdUser.designation,
          division: createdUser.division,
          must_change_password: Boolean(createdUser.must_change_password),
        },
      };
    } catch (error) {
      if (error?.statusCode) {
        if (Number(error.statusCode) === 400 && !error.code) {
          throw buildAuthError({
            statusCode: 400,
            code: "INVALID_PROVISION_PAYLOAD",
            message: "Employee provisioning payload is invalid.",
            hint: "Correct the employee details and try again.",
            details: Array.isArray(error?.explanation) ? error.explanation : [],
          });
        }
        throw error;
      }
      if (error?.name === "SequelizeUniqueConstraintError") {
        throw buildAuthError({
          statusCode: 409,
          code: "USER_ALREADY_EXISTS_CONFLICT",
          message: "A matching Auth account already exists.",
          hint: "Review the existing Auth account before retrying provisioning.",
          details: Array.isArray(error?.errors)
            ? error.errors
                .map((entry) => String(entry?.message || "").trim())
                .filter(Boolean)
            : [],
        });
      }
      if (error?.name === "SequelizeValidationError") {
        throw buildAuthError({
          statusCode: 400,
          code: "INVALID_PROVISION_PAYLOAD",
          message: "Employee provisioning payload is invalid.",
          hint: "Correct the employee details and try again.",
          details: Array.isArray(error?.explanation) ? error.explanation : [],
        });
      }
      throw buildAuthError({
        statusCode: 500,
        code: "PROVISION_FAILED",
        message: "Unable to provision user from employee.",
        explanation: "Something went wrong while creating the Auth account.",
        hint: "Please try again in a moment.",
      });
    }
  }

  async activateFromEmployee(data = {}, context = {}) {
    const payload = this.buildEmployeeUserPayload(data, {
      password: String(data?.newPassword || ""),
      mustChangePassword: false,
      includePassword: true,
      passwordChangedAt: new Date(),
    });

    const validationErrors = this.collectEmployeeUserPayloadValidationErrors(payload, {
      requirePassword: true,
    });
    if (validationErrors.length) {
      throw buildAuthError({
        statusCode: 400,
        code: "INVALID_ACTIVATION_PAYLOAD",
        message: "Employee activation payload is invalid.",
        hint: "Send complete employee details and a valid new password to continue.",
        details: validationErrors,
      });
    }

    this.validateNewPasswordInput(null, {
      newPassword: data?.newPassword,
      confirmPassword: data?.confirmPassword,
    });

    const preview = await this.previewActivationFromEmployee(payload, context);
    if (preview.action === "already_exists") {
      throw buildAuthError({
        statusCode: 409,
        code: "ACCOUNT_ALREADY_EXISTS",
        message: "An account already exists for this employee.",
        hint: "Please sign in with your existing credentials or contact the administrator.",
        data: {
          activation_state: preview.activation_state,
          user: preview.user,
        },
      });
    }

    try {
      const createdUser = await this.UserRepository.create(payload);
      return {
        action: "activated",
        activation_state: "active",
        source_service: normalizeText(context?.serviceName) || null,
        user: {
          id: createdUser.id,
          empcode: createdUser.empcode,
          fullname: createdUser.fullname,
          mobileno: createdUser.mobileno,
          designation: createdUser.designation,
          division: createdUser.division,
          must_change_password: Boolean(createdUser.must_change_password),
        },
      };
    } catch (error) {
      if (error?.statusCode) {
        if (Number(error.statusCode) === 400 && !error.code) {
          throw buildAuthError({
            statusCode: 400,
            code: "INVALID_ACTIVATION_PAYLOAD",
            message: "Employee activation payload is invalid.",
            hint: "Correct the activation details and try again.",
            details: Array.isArray(error?.explanation) ? error.explanation : [],
          });
        }
        throw error;
      }
      if (error?.name === "SequelizeUniqueConstraintError") {
        throw buildAuthError({
          statusCode: 409,
          code: "ACCOUNT_ALREADY_EXISTS",
          message: "An account already exists for this employee.",
          hint: "Please sign in with your existing credentials or contact the administrator.",
          details: Array.isArray(error?.errors)
            ? error.errors
                .map((entry) => String(entry?.message || "").trim())
                .filter(Boolean)
            : [],
        });
      }
      if (error?.name === "SequelizeValidationError") {
        throw buildAuthError({
          statusCode: 400,
          code: "INVALID_ACTIVATION_PAYLOAD",
          message: "Employee activation payload is invalid.",
          hint: "Correct the activation details and try again.",
          details: Array.isArray(error?.explanation) ? error.explanation : [],
        });
      }
      throw buildAuthError({
        statusCode: 500,
        code: "ACCOUNT_ACTIVATION_FAILED",
        message: "Unable to activate the account.",
        explanation: "Something went wrong while creating the Auth account.",
        hint: "Please try again in a moment.",
      });
    }
  }

  async signIn(mobileno, plainPassword) {
    try {
      if (!mobileno || !plainPassword) {
        throw invalidCredentialsError();
      }

      const user = await withTimeout(
        this.UserRepository.getByMobileNo(mobileno),
        Number(process.env.AUTH_DB_QUERY_TIMEOUT_MS || 10_000),
        authTimeoutError,
      );
      const passwordMatch = this.checkPassword(plainPassword, user.password);

      if (!passwordMatch) {
        throw invalidCredentialsError();
      }

      await this.verifyStoreEmployeeLoginEligibility(user);

      if (user.must_change_password) {
        throw passwordChangeRequiredError(this.buildPasswordChangeRequiredPayload(user));
      }

      return this.buildSessionPayload(user);
    } catch (error) {
      if (error?.name === "AttributeNotFound") {
        throw invalidCredentialsError();
      }
      if (Number(error?.statusCode) === 401) {
        throw invalidCredentialsError();
      }
      if (error?.statusCode) {
        throw error;
      }
      throw {
        statusCode: 500,
        message: "Sign-in failed",
        explanation: "Unable to complete sign-in at this time.",
      };
    }
  }

  async isAuthenticated(token) {
    if (!String(token || "").trim()) {
      throw tokenMissingError();
    }

    let decodedToken;
    try {
      decodedToken = this.verifyToken(token);
    } catch (error) {
      throw mapTokenVerificationError(error);
    }

    const user = await withTimeout(
      this.UserRepository.getById(decodedToken.id),
      Number(process.env.AUTH_DB_QUERY_TIMEOUT_MS || 10_000),
      authTimeoutError,
    );
    if (!user) {
      throw userNotFoundForTokenError();
    }

    this.ensureSessionStillValidForPasswordVersion(user, decodedToken);

    if (user.must_change_password) {
      throw passwordChangeRequiredError();
    }

    const locationScopeKeys = serializeLocationScopeKeys(
      user.userLocationScopes,
    );
    return {
      id: user.id,
      empcode: user.empcode,
      fullname: user.fullname,
      mobileno: user.mobileno,
      designation: user.designation,
      division: user.division,
      roles: serializeRoles(user.roles).map((role) => role.name),
      must_change_password: Boolean(user.must_change_password),
      password_changed_at: user.password_changed_at || null,
      location_scopes: locationScopeKeys,
      location_scope_source: locationScopeKeys.length ? "explicit" : null,
      assignments: serializeAssignments(user.orgAssignments),
      session: {
        token_payload: {
          iat: Number(decodedToken?.iat) || null,
          exp: Number(decodedToken?.exp) || null,
        },
      },
    };
  }
  createToken(user) {
    try {
      if (!JWT_KEY || String(JWT_KEY).trim().length < 32) {
        throw new Error("JWT_KEY is missing or too weak.");
      }
      const result = jwt.sign(user, JWT_KEY, { expiresIn: "1d" });
      return result;
    } catch (error) {
      throw error;
    }
  }
  verifyToken(token) {
    try {
      const response = jwt.verify(token, JWT_KEY);
      return response;
    } catch (error) {
      throw error;
    }
  }

  checkPassword(userInputPlainPassword, encryptedPassword) {
    try {
      return bcrypt.compareSync(userInputPlainPassword, encryptedPassword);
    } catch (error) {
      throw error;
    }
  }

  isAdmin(userId) {
    try {
      return this.UserRepository.isAdmin(userId);
    } catch (error) {
      throw error;
    }
  }

  async getUserRoles(userId) {
    const user = await this.UserRepository.getUserRoles(userId);
    if (!user) {
      throw {
        statusCode: 404,
        message: "User not found.",
      };
    }

    return {
      id: user.id,
      fullname: user.fullname,
      mobileno: user.mobileno,
      roles: serializeRoles(user.roles),
    };
  }

  async getUserLocationScopes(userId) {
    const user = await this.UserRepository.getUserLocationScopes(userId);
    if (!user) {
      throw {
        statusCode: 404,
        message: "User not found.",
      };
    }

    return {
      id: user.id,
      fullname: user.fullname,
      mobileno: user.mobileno,
      location_scopes: serializeLocationScopes(user.userLocationScopes),
    };
  }

  async listUsers(query = {}) {
    const users = await this.UserRepository.listUsers(query);
    return users.map((user) => serializeUserSummary(user));
  }

  async resolvePendingQueueHolders(payload = {}) {
    const targets = Array.isArray(payload?.targets)
      ? payload.targets
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];

    const normalizedTargets = targets
      .map((target) => {
        const requisitionId = Number(target?.requisition_id ?? target?.id);
        if (!Number.isFinite(requisitionId) || requisitionId <= 0) return null;

        const status = String(target?.status || "").trim();
        const currentStageRole = String(
          target?.current_stage_role || target?.pending_role || "",
        )
          .trim()
          .toUpperCase();
        const derivedPendingRole =
          currentStageRole ||
          (STORE_STAGE_STATUSES.has(status) ? "STORE_ENTRY" : "");

        return {
          requisition_id: requisitionId,
          pending_role: derivedPendingRole || null,
          requester_division: normalizeDivisionValue(target?.requester_division) || null,
          location_scope: normalizeLocationScopeKey(target?.location_scope),
        };
      })
      .filter(Boolean);

    if (!normalizedTargets.length) {
      return { targets: [] };
    }

    const needsDivisionHeads = normalizedTargets.some(
      (target) => target.pending_role === "DIVISION_HEAD",
    );
    const needsStoreIncharge = normalizedTargets.some(
      (target) => target.pending_role === "STORE_ENTRY",
    );

    const assignmentService = require("./org-assignment-service");
    const [divisionAssignments, storeAssignments] = await Promise.all([
      needsDivisionHeads
        ? assignmentService.list({ assignmentType: "DIVISION_HEAD", active: true })
        : Promise.resolve([]),
      needsStoreIncharge
        ? assignmentService.list({ assignmentType: "STORE_INCHARGE", active: true })
        : Promise.resolve([]),
    ]);

    const roleNamesForFallback = [...new Set(
      normalizedTargets
        .map((target) => target.pending_role)
        .filter((roleName) => roleName && roleName !== "DIVISION_HEAD"),
    )];
    const roleUsers = roleNamesForFallback.length
      ? await this.UserRepository.listUsersByRoleNames(roleNamesForFallback)
      : [];

    const roleUsersByRole = new Map();
    for (const user of roleUsers) {
      const roles = Array.isArray(user?.roles) ? user.roles : [];
      for (const role of roles) {
        const roleName = String(role?.name || "").trim().toUpperCase();
        if (!roleName || !roleNamesForFallback.includes(roleName)) continue;
        const currentUsers = roleUsersByRole.get(roleName) || [];
        currentUsers.push(user);
        roleUsersByRole.set(roleName, currentUsers);
      }
    }

    const resolvedTargets = normalizedTargets.map((target) => {
      let matchedUsers = [];
      let source = null;

      if (target.pending_role === "DIVISION_HEAD" && target.requester_division) {
        matchedUsers = (Array.isArray(divisionAssignments) ? divisionAssignments : [])
          .filter((assignment) =>
            normalizeDivisionValue(
              assignment?.metadata_json?.division_value ||
                assignment?.scope_label ||
                assignment?.metadata_json?.display_name,
            ) === target.requester_division,
          )
          .map((assignment) => assignment?.user)
          .filter(Boolean);
        if (matchedUsers.length) {
          source = "assignment";
        }
      }

      if (!matchedUsers.length && target.pending_role === "STORE_ENTRY" && target.location_scope) {
        matchedUsers = (Array.isArray(storeAssignments) ? storeAssignments : [])
          .filter((assignment) => {
            const location = normalizeLocationScopeKey(
              assignment?.metadata_json?.location ||
                assignment?.scope_key ||
                assignment?.scope_label,
            );
            return location === target.location_scope;
          })
          .map((assignment) => assignment?.user)
          .filter(Boolean);
        if (matchedUsers.length) {
          source = "assignment";
        }
      }

      if (!matchedUsers.length && target.pending_role) {
        matchedUsers = roleUsersByRole.get(target.pending_role) || [];
        if (matchedUsers.length) {
          source = "role";
        }
      }

      const holders = buildUniqueUsers(matchedUsers);
      return {
        requisition_id: target.requisition_id,
        pending_role: target.pending_role,
        source,
        holder_count: holders.length,
        primary_holder: holders[0] || null,
        holders,
      };
    });

    return {
      targets: resolvedTargets,
    };
  }

  async listRoles() {
    const roles = await this.UserRepository.listRoles();
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      managed_by_assignment: isAssignmentManagedRole(role.name),
      is_default_role:
        String(role.name || "")
          .trim()
          .toUpperCase() === DEFAULT_SIGNUP_ROLE,
    }));
  }

  async assignRole(userId, roleName) {
    const normalizedRoleName = String(roleName || "")
      .trim()
      .toUpperCase();
    if (!normalizedRoleName) {
      throw {
        statusCode: 400,
        message: "roleName is required.",
      };
    }
    if (isAssignmentManagedRole(normalizedRoleName)) {
      throw {
        statusCode: 400,
        message: `Role ${normalizedRoleName} is managed through organizational assignments.`,
      };
    }

    await this.UserRepository.assignRoleToUser(userId, normalizedRoleName);
    return this.getUserRoles(userId);
  }

  async removeRole(userId, roleName) {
    const normalizedRoleName = String(roleName || "")
      .trim()
      .toUpperCase();
    if (!normalizedRoleName) {
      throw {
        statusCode: 400,
        message: "roleName is required.",
      };
    }
    if (normalizedRoleName === DEFAULT_SIGNUP_ROLE) {
      throw {
        statusCode: 400,
        message: "USER role cannot be removed manually.",
      };
    }
    if (isAssignmentManagedRole(normalizedRoleName)) {
      throw {
        statusCode: 400,
        message: `Role ${normalizedRoleName} is managed through organizational assignments.`,
      };
    }

    await this.UserRepository.removeRoleFromUser(userId, normalizedRoleName);
    return this.getUserRoles(userId);
  }

  async assignLocationScope(userId, locationScope, options = {}) {
    const normalizedLocationScope = String(locationScope || "")
      .trim()
      .toUpperCase();
    if (!normalizedLocationScope) {
      throw {
        statusCode: 400,
        message: "locationScope is required.",
      };
    }

    await this.UserRepository.assignLocationScopeToUser(
      userId,
      {
        locationScope: normalizedLocationScope,
        scopeLabel: options.scopeLabel || normalizedLocationScope,
        actorUserId: options.actorUserId || null,
      },
    );
    return this.getUserLocationScopes(userId);
  }

  async removeLocationScope(userId, locationScope, options = {}) {
    const normalizedLocationScope = String(locationScope || "")
      .trim()
      .toUpperCase();
    if (!normalizedLocationScope) {
      throw {
        statusCode: 400,
        message: "locationScope is required.",
      };
    }

    await this.UserRepository.removeLocationScopeFromUser(
      userId,
      normalizedLocationScope,
      {
        actorUserId: options.actorUserId || null,
      },
    );
    return this.getUserLocationScopes(userId);
  }
}
module.exports = UserService;
