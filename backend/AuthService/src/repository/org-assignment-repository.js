const { Op } = require("sequelize");
const { OrgAssignment, User } = require("../models");

class OrgAssignmentRepository {
  async list({
    userId = null,
    assignmentType = null,
    scopeType = null,
    scopeKey = null,
    active = null,
  } = {}) {
    const where = {};
    if (userId) where.user_id = Number(userId);
    if (assignmentType) where.assignment_type = assignmentType;
    if (scopeType) where.scope_type = scopeType;
    if (scopeKey) where.scope_key = scopeKey;
    if (active !== null && active !== undefined) where.active = Boolean(active);

    return OrgAssignment.findAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "empcode",
            "fullname",
            "mobileno",
            "designation",
            "division",
          ],
        },
      ],
      order: [
        ["active", "DESC"],
        ["assignment_type", "ASC"],
        ["scope_type", "ASC"],
        ["scope_label", "ASC"],
        ["id", "DESC"],
      ],
    });
  }

  async findByIdForUpdate(id, transaction) {
    return OrgAssignment.findByPk(id, {
      transaction,
      lock: transaction?.LOCK?.UPDATE,
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "empcode",
            "fullname",
            "mobileno",
            "designation",
            "division",
          ],
        },
      ],
    });
  }

  async findActiveByScope(
    assignmentType,
    scopeType,
    scopeKey,
    transaction,
  ) {
    return OrgAssignment.findAll({
      where: {
        assignment_type: assignmentType,
        scope_type: scopeType,
        scope_key: scopeKey,
        active: true,
      },
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });
  }

  async findActiveForUserByType(userId, assignmentType, transaction) {
    return OrgAssignment.findAll({
      where: {
        user_id: Number(userId),
        assignment_type: assignmentType,
        active: true,
      },
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });
  }

  async create(data, transaction) {
    return OrgAssignment.create(data, {
      transaction,
    });
  }

  async endAssignments(ids = [], payload = {}, transaction) {
    if (!ids.length) return;
    await OrgAssignment.update(
      {
        active: false,
        effective_to: payload.effective_to || new Date(),
        ended_by_user_id: payload.ended_by_user_id || null,
      },
      {
        where: {
          id: { [Op.in]: ids },
          active: true,
        },
        transaction,
      },
    );
  }
}

module.exports = OrgAssignmentRepository;
