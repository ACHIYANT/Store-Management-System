const UserRepository = require("../repository/user-repository");
const jwt = require("jsonwebtoken");
const {
  EMPLOYEE_PROVISION_DEFAULT_PASSWORD,
  JWT_KEY,
  PASSWORD_CHANGE_JWT_KEY,
  PASSWORD_CHANGE_TOKEN_TTL,
} = require("../config/serverConfig");
const bcrypt = require("bcrypt");
const { isAssignmentManagedRole } = require("../constants/org-assignments");
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

  async provisionFromEmployee(data = {}, context = {}) {
    const empcode = Number(data?.empcode ?? data?.emp_id);
    const payload = {
      empcode,
      fullname: normalizeText(data?.fullname ?? data?.name),
      mobileno: normalizeText(data?.mobileno ?? data?.mobile_no),
      designation: normalizeText(data?.designation),
      division: normalizeText(data?.division),
      password: String(EMPLOYEE_PROVISION_DEFAULT_PASSWORD || "").trim(),
      must_change_password: true,
    };

    const validationErrors = [];
    if (!Number.isInteger(payload.empcode) || payload.empcode <= 0) {
      validationErrors.push("empcode must be a positive integer.");
    }
    if (!payload.fullname) validationErrors.push("fullname is required.");
    if (!payload.mobileno) validationErrors.push("mobileno is required.");
    if (!payload.designation) validationErrors.push("designation is required.");
    if (!payload.division) validationErrors.push("division is required.");
    if (!payload.password) {
      validationErrors.push("Default provisioning password is not configured.");
    }

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
    const empcode = Number(data?.empcode ?? data?.emp_id);
    const payload = {
      empcode,
      fullname: normalizeText(data?.fullname ?? data?.name),
      mobileno: normalizeText(data?.mobileno ?? data?.mobile_no),
      designation: normalizeText(data?.designation),
      division: normalizeText(data?.division),
      password: String(EMPLOYEE_PROVISION_DEFAULT_PASSWORD || "").trim(),
      must_change_password: true,
    };

    const validationErrors = [];
    if (!Number.isInteger(payload.empcode) || payload.empcode <= 0) {
      validationErrors.push("empcode must be a positive integer.");
    }
    if (!payload.fullname) validationErrors.push("fullname is required.");
    if (!payload.mobileno) validationErrors.push("mobileno is required.");
    if (!payload.designation) validationErrors.push("designation is required.");
    if (!payload.division) validationErrors.push("division is required.");
    if (!payload.password) {
      validationErrors.push("Default provisioning password is not configured.");
    }

    if (validationErrors.length) {
      throw buildAuthError({
        statusCode: 400,
        code: "INVALID_PROVISION_PAYLOAD",
        message: "Employee provisioning payload is invalid.",
        hint: "Send complete employee details and ensure the default provisioning password is configured.",
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
          `fullname mismatch: Auth has '${existingByEmpcode.fullname}', provisioning requested '${payload.fullname}'.`,
        );
      }
      if (!eqText(existingByEmpcode.mobileno, payload.mobileno)) {
        mismatchDetails.push(
          `mobileno mismatch: Auth has '${existingByEmpcode.mobileno}', provisioning requested '${payload.mobileno}'.`,
        );
      }
      if (!eqText(existingByEmpcode.designation, payload.designation)) {
        mismatchDetails.push(
          `designation mismatch: Auth has '${existingByEmpcode.designation}', provisioning requested '${payload.designation}'.`,
        );
      }
      if (!eqText(existingByEmpcode.division, payload.division)) {
        mismatchDetails.push(
          `division mismatch: Auth has '${existingByEmpcode.division}', provisioning requested '${payload.division}'.`,
        );
      }

      if (mismatchDetails.length) {
        throw buildAuthError({
          statusCode: 409,
          code: "USER_ALREADY_EXISTS_CONFLICT",
          message: `User already exists for empcode ${payload.empcode} with different details.`,
          hint: "Review the existing Auth account before retrying provisioning.",
          details: mismatchDetails,
        });
      }

      return {
        action: "already_exists",
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
        hint: "Use a different mobile number or fix the existing Auth account before retrying provisioning.",
      });
    }

    return {
      action: "create",
      source_service: normalizeText(context?.serviceName) || null,
      user: {
        id: null,
        empcode: payload.empcode,
        fullname: payload.fullname,
        mobileno: payload.mobileno,
        designation: payload.designation,
        division: payload.division,
        must_change_password: true,
      },
    };
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

      if (user.must_change_password) {
        throw passwordChangeRequiredError(this.buildPasswordChangeRequiredPayload(user));
      }

      return this.buildSessionPayload(user);
    } catch (error) {
      if (
        error?.statusCode === 401 ||
        error?.name === "AttributeNotFound"
      ) {
        throw invalidCredentialsError();
      }
      if (error?.code === "PASSWORD_CHANGE_REQUIRED") {
        throw error;
      }
      if (error?.statusCode === 503) {
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
