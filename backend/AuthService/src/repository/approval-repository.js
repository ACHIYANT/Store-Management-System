// src/repository/approval-repository.js
const { approval_stages } = require("../models");
const { Op } = require("sequelize");

const FLOW_TYPES = new Set(["DAYBOOK", "REQUISITION", "ALL"]);

function normalizeFlowType(flowType) {
  if (flowType === undefined || flowType === null || flowType === "") {
    return null;
  }
  const normalized = String(flowType).trim().toUpperCase();
  return FLOW_TYPES.has(normalized) ? normalized : null;
}

class ApprovalRepository {
  async getActiveStages(flowType = null) {
    const normalizedFlowType = normalizeFlowType(flowType);
    const where = {
      active: true,
      role_name: { [Op.ne]: "SUPER_ADMIN" },
    };

    if (normalizedFlowType === "DAYBOOK") {
      where[Op.or] = [
        { flow_type: "DAYBOOK" },
        { flow_type: "ALL" },
        { flow_type: null },
      ];
    } else if (normalizedFlowType === "REQUISITION") {
      where[Op.or] = [{ flow_type: "REQUISITION" }, { flow_type: "ALL" }];
    } else if (normalizedFlowType === "ALL") {
      where.flow_type = "ALL";
    }

    return await approval_stages.findAll({
      where,
      order: [["stage_order", "ASC"]],
    });
  }

  async addStage(role_name, stage_order, flow_type = "DAYBOOK") {
    if (String(role_name || "").toUpperCase() === "SUPER_ADMIN") {
      const error = new Error(
        "SUPER_ADMIN cannot be part of approval stages.",
      );
      error.statusCode = 400;
      throw error;
    }

    const normalizedFlowType = normalizeFlowType(flow_type);
    if (!normalizedFlowType) {
      const error = new Error(
        "Invalid flow_type. Allowed values: DAYBOOK, REQUISITION, ALL.",
      );
      error.statusCode = 400;
      throw error;
    }

    return await approval_stages.create({
      role_name,
      stage_order,
      flow_type: normalizedFlowType,
      active: true,
    });
  }

  async deactivateStage(stageId) {
    return await approval_stages.update(
      { active: false },
      { where: { id: stageId } }
    );
  }
}

module.exports = new ApprovalRepository();
