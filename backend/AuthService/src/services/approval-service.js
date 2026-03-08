// src/services/approval-service.js
const ApprovalRepository = require("../repository/approval-repository");

class ApprovalService {
  async fetchStages(flowType = null) {
    return await ApprovalRepository.getActiveStages(flowType);
  }

  async addStage(role_name, stage_order, flow_type = "DAYBOOK") {
    return await ApprovalRepository.addStage(role_name, stage_order, flow_type);
  }

  async deactivateStage(stageId) {
    return await ApprovalRepository.deactivateStage(stageId);
  }
}

module.exports = new ApprovalService();
