const { Op } = require("sequelize");
const {
  User,
  Role,
  OrgAssignment,
  UserLocationScope,
  sequelize,
} = require("../models/index");
const ValidationError = require("../utils/validation-error");
const ClientError = require("../utils/client-error");
const { StatusCodes } = require("http-status-codes");
const {
  getManagedRoleNameForAssignment,
  isAssignmentManagedRole,
  normalizeAssignmentType,
} = require("../constants/org-assignments");

const DEFAULT_SIGNUP_ROLE = "USER";

class UserRepository {
  normalizeLocationScope(value) {
    const text = String(value || "").trim().replace(/\s+/g, " ");
    return text ? text.toUpperCase() : "";
  }

  async create(data) {
    try {
      return await sequelize.transaction(async (transaction) => {
        const user = await User.create(data, { transaction });
        const defaultRole = await Role.findOne({
          where: { name: DEFAULT_SIGNUP_ROLE },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!defaultRole) {
          const error = new Error("Default USER role is not configured.");
          error.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
          throw error;
        }

        await user.addRole(defaultRole, { transaction });
        return user;
      });
    } catch (error) {
      if (error.name == "SequelizeValidationError") {
        throw new ValidationError(error);
      }
      console.log("Something went wrong on repository layer");
      throw error;
    }
  }
  async destroy(userId) {
    try {
      await User.destroy({
        where: {
          id: userId,
        },
      });
      return true;
    } catch (error) {
      console.log("Something went wrong on repository layer");
      throw error;
    }
  }
  async getById(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: [
          "id",
          "empcode",
          "fullname",
          "mobileno",
          "designation",
          "division",
        ],
        include: [
          {
            model: Role,
            as: "roles",
            through: { attributes: [] },
            attributes: ["id", "name"],
          },
          {
            model: OrgAssignment,
            as: "orgAssignments",
            required: false,
            where: { active: true },
            attributes: [
              "id",
              "assignment_type",
              "scope_type",
              "scope_key",
              "scope_label",
              "effective_from",
              "metadata_json",
              "notes",
            ],
          },
          {
            model: UserLocationScope,
            as: "userLocationScopes",
            required: false,
            where: { active: true },
            attributes: [
              "id",
              "location_scope",
              "scope_label",
              "effective_from",
            ],
          },
        ],
      });
      return user;
    } catch (error) {
      console.log("Something went wrong on repository layer");
      throw error;
    }
  }

  async getByMobileNo(userMobileNo) {
    try {
      const user = await User.findOne({
        where: {
          mobileno: userMobileNo,
        },
        include: [
          {
            model: Role,
            as: "roles", // make sure you defined alias in your model association
            through: { attributes: [] }, // exclude join table fields
            attributes: ["id", "name"], // only return id & name of roles
          },
        ],
      });
      if (!user) {
        throw new ClientError(
          "AttributeNotFound",
          "Invalid username sent in the request",
          "Please check the email, as there is no record of the username.",
          StatusCodes.NOT_FOUND,
        );
      }
      return user;
    } catch (error) {
      console.log("Something went wrong on repository layer");
      throw error;
    }
  }

  async findByEmpcode(empcode) {
    return User.findOne({
      where: {
        empcode: Number(empcode),
      },
      attributes: [
        "id",
        "empcode",
        "fullname",
        "mobileno",
        "designation",
        "division",
      ],
    });
  }

  async findByMobileNoOptional(userMobileNo) {
    return User.findOne({
      where: {
        mobileno: String(userMobileNo || "").trim(),
      },
      attributes: [
        "id",
        "empcode",
        "fullname",
        "mobileno",
        "designation",
        "division",
      ],
    });
  }

  async isAdmin(userId) {
    try {
      const user = await User.findByPk(userId);
      const adminRoles = await Role.findAll({
        where: {
          name: {
            // [Op.in]: ["ADMIN", "SUPER_ADMIN"],
            [Op.in]: ["SUPER_ADMIN"],
          },
        },
      });
      if (!user || !adminRoles.length) return false;
      const checks = await Promise.all(
        adminRoles.map((role) => user.hasRole(role)),
      );
      return checks.some(Boolean);
    } catch (error) {
      console.log("Something went wrong on repository layer");
      throw error;
    }
  }

  async getUserByIdForUpdate(userId, transaction) {
    return User.findByPk(userId, {
      transaction,
      lock: transaction?.LOCK?.UPDATE,
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
      ],
    });
  }

  async findRoleByName(roleName, transaction = null) {
    return Role.findOne({
      where: {
        name: String(roleName || "")
          .trim()
          .toUpperCase(),
      },
      transaction: transaction || undefined,
      lock: transaction?.LOCK?.UPDATE,
    });
  }

  async getUserRoles(userId) {
    return User.findByPk(userId, {
      attributes: ["id", "fullname", "mobileno"],
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
      ],
    });
  }

  async getUserLocationScopes(userId) {
    return User.findByPk(userId, {
      attributes: ["id", "fullname", "mobileno"],
      include: [
        {
          model: UserLocationScope,
          as: "userLocationScopes",
          required: false,
          where: { active: true },
          attributes: [
            "id",
            "location_scope",
            "scope_label",
            "effective_from",
          ],
        },
      ],
    });
  }

  async listUsers({ search = "", limit = 100 } = {}) {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
    const q = String(search || "").trim();
    const where = {};

    if (q) {
      const like = `%${q}%`;
      where[Op.or] = [
        { fullname: { [Op.like]: like } },
        { mobileno: { [Op.like]: like } },
        { division: { [Op.like]: like } },
        { designation: { [Op.like]: like } },
      ];
      const numericEmpCode = Number(q);
      if (Number.isFinite(numericEmpCode)) {
        where[Op.or].push({ empcode: numericEmpCode });
      }
    }

    return User.findAll({
      where,
      attributes: [
        "id",
        "empcode",
        "fullname",
        "mobileno",
        "designation",
        "division",
      ],
      include: [
        {
          model: Role,
          as: "roles",
          through: { attributes: [] },
          attributes: ["id", "name"],
        },
        {
          model: OrgAssignment,
          as: "orgAssignments",
          required: false,
          where: { active: true },
          attributes: [
            "id",
            "assignment_type",
            "scope_type",
            "scope_key",
            "scope_label",
            "metadata_json",
            "effective_from",
          ],
        },
        {
          model: UserLocationScope,
          as: "userLocationScopes",
          required: false,
          where: { active: true },
          attributes: [
            "id",
            "location_scope",
            "scope_label",
            "effective_from",
          ],
        },
      ],
      order: [
        ["fullname", "ASC"],
        ["id", "ASC"],
      ],
      limit: safeLimit,
    });
  }

  async listRoles() {
    return Role.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });
  }

  async assignLocationScopeToUser(
    userId,
    { locationScope, scopeLabel = null, actorUserId = null } = {},
    transaction = null,
  ) {
    if (!transaction) {
      return sequelize.transaction((managedTransaction) =>
        this.assignLocationScopeToUser(
          userId,
          { locationScope, scopeLabel, actorUserId },
          managedTransaction,
        ),
      );
    }

    const normalizedLocationScope = this.normalizeLocationScope(locationScope);
    if (!normalizedLocationScope) {
      const error = new Error("locationScope is required.");
      error.statusCode = StatusCodes.BAD_REQUEST;
      throw error;
    }

    const user = await this.getUserByIdForUpdate(userId, transaction);
    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = StatusCodes.NOT_FOUND;
      throw error;
    }

    const existing = await UserLocationScope.findOne({
      where: {
        user_id: user.id,
        location_scope: normalizedLocationScope,
        active: true,
      },
      transaction: transaction || undefined,
      lock: transaction?.LOCK?.UPDATE,
    });

    if (existing) {
      return existing;
    }

    return UserLocationScope.create(
      {
        user_id: user.id,
        location_scope: normalizedLocationScope,
        scope_label: scopeLabel ? String(scopeLabel).trim() : normalizedLocationScope,
        active: true,
        effective_from: new Date(),
        created_by_user_id: Number.isFinite(Number(actorUserId))
          ? Number(actorUserId)
          : null,
      },
      { transaction: transaction || undefined },
    );
  }

  async removeLocationScopeFromUser(
    userId,
    locationScope,
    { actorUserId = null } = {},
    transaction = null,
  ) {
    if (!transaction) {
      return sequelize.transaction((managedTransaction) =>
        this.removeLocationScopeFromUser(
          userId,
          locationScope,
          { actorUserId },
          managedTransaction,
        ),
      );
    }

    const normalizedLocationScope = this.normalizeLocationScope(locationScope);
    if (!normalizedLocationScope) {
      const error = new Error("locationScope is required.");
      error.statusCode = StatusCodes.BAD_REQUEST;
      throw error;
    }

    const user = await this.getUserByIdForUpdate(userId, transaction);
    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = StatusCodes.NOT_FOUND;
      throw error;
    }

    const activeScopes = await UserLocationScope.findAll({
      where: {
        user_id: user.id,
        location_scope: normalizedLocationScope,
        active: true,
      },
      transaction: transaction || undefined,
      lock: transaction?.LOCK?.UPDATE,
    });

    if (!activeScopes.length) {
      const error = new Error(
        `Location scope ${normalizedLocationScope} is not active for this user.`,
      );
      error.statusCode = StatusCodes.NOT_FOUND;
      throw error;
    }

    await Promise.all(
      activeScopes.map((scopeRow) =>
        scopeRow.update(
          {
            active: false,
            effective_to: new Date(),
            ended_by_user_id: Number.isFinite(Number(actorUserId))
              ? Number(actorUserId)
              : null,
          },
          { transaction: transaction || undefined },
        ),
      ),
    );

    return normalizedLocationScope;
  }

  async assignRoleToUser(userId, roleName, transaction = null) {
    const normalizedRoleName = String(roleName || "").trim().toUpperCase();
    const user = await this.getUserByIdForUpdate(userId, transaction);
    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = StatusCodes.NOT_FOUND;
      throw error;
    }

    const role = await this.findRoleByName(normalizedRoleName, transaction);
    if (!role) {
      const error = new Error(`Role ${normalizedRoleName} not found.`);
      error.statusCode = StatusCodes.NOT_FOUND;
      throw error;
    }

    const hasRole = await user.hasRole(role, {
      transaction: transaction || undefined,
    });
    if (!hasRole) {
      await user.addRole(role, { transaction: transaction || undefined });
    }

    return role;
  }

  async removeRoleFromUser(userId, roleName, transaction = null) {
    const normalizedRoleName = String(roleName || "").trim().toUpperCase();
    const user = await this.getUserByIdForUpdate(userId, transaction);
    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = StatusCodes.NOT_FOUND;
      throw error;
    }

    const role = await this.findRoleByName(normalizedRoleName, transaction);
    if (!role) {
      const error = new Error(`Role ${normalizedRoleName} not found.`);
      error.statusCode = StatusCodes.NOT_FOUND;
      throw error;
    }

    const hasRole = await user.hasRole(role, {
      transaction: transaction || undefined,
    });
    if (hasRole) {
      await user.removeRole(role, { transaction: transaction || undefined });
    }

    return role;
  }

  async syncManagedRoleForUser(userId, assignmentType, transaction) {
    const normalizedAssignmentType = normalizeAssignmentType(assignmentType);
    const managedRoleName =
      getManagedRoleNameForAssignment(normalizedAssignmentType);
    if (!managedRoleName) return;

    const activeCount = await OrgAssignment.count({
      where: {
        user_id: userId,
        assignment_type: normalizedAssignmentType,
        active: true,
      },
      transaction,
    });

    if (activeCount > 0) {
      await this.assignRoleToUser(userId, managedRoleName, transaction);
      return;
    }

    await this.removeRoleFromUser(userId, managedRoleName, transaction);
  }

  isAssignmentManagedRole(roleName) {
    return isAssignmentManagedRole(roleName);
  }
}

module.exports = UserRepository;
