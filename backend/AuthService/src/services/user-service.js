const UserRepository = require("../repository/user-repository");
const jwt = require("jsonwebtoken");
const { JWT_KEY } = require("../config/serverConfig");
const bcrypt = require("bcrypt");
const { isAssignmentManagedRole } = require("../constants/org-assignments");

const DEFAULT_SIGNUP_ROLE = "USER";

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
  message: "Invalid credentials",
  explanation: "Mobile number or password is incorrect.",
});

const authTimeoutError = () => ({
  statusCode: 503,
  message: "Authentication service timeout",
  explanation:
    "Unable to complete authentication right now. Please try again in a moment.",
});

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
    try {
      const response = this.verifyToken(token);
      if (!response) {
        throw { error: "Invalid Token" };
      }
      const user = await withTimeout(
        this.UserRepository.getById(response.id),
        Number(process.env.AUTH_DB_QUERY_TIMEOUT_MS || 10_000),
        authTimeoutError,
      );
      if (!user) {
        throw { error: "No user with the corresponding token exists." };
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
      };
    } catch (error) {
      throw error;
    }
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
