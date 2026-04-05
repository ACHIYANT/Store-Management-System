const UserRepository = require("../repository/user-repository");
const jwt = require("jsonwebtoken");
const {
  EMPLOYEE_PROVISION_DEFAULT_PASSWORD,
  JWT_KEY,
} = require("../config/serverConfig");
const bcrypt = require("bcrypt");
const { isAssignmentManagedRole } = require("../constants/org-assignments");

const DEFAULT_SIGNUP_ROLE = "USER";

const buildAuthError = ({
  statusCode = 401,
  code = "UNAUTHORIZED",
  message = "Unauthorized.",
  explanation = "",
  hint = "",
  details = [],
} = {}) => ({
  statusCode,
  code,
  message,
  explanation,
  hint,
  details,
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

      const roles = user.roles ? user.roles.map((r) => r.name) : [];
      const newJWT = this.createToken({
        mobileno: user.mobileno,
        id: user.id,
        roles,
      });
      const fullName = user.fullname;
      return {
        newJWT,
        fullName,
        roles,
      };
    } catch (error) {
      if (error?.statusCode === 401 || error?.name === "AttributeNotFound") {
        throw invalidCredentialsError();
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
