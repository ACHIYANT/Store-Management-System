// src/controllers/approval-controller.js
const ApprovalService = require("../services/approval-service");

const getApprovalStages = async (req, res) => {
  try {
    const { flow_type } = req.query;
    const stages = await ApprovalService.fetchStages(flow_type);
    return res.status(200).json({ success: true, data: stages });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const addApprovalStage = async (req, res) => {
  try {
    const { role_name, stage_order, flow_type } = req.body;
    const stage = await ApprovalService.addStage(
      role_name,
      stage_order,
      flow_type,
    );
    return res.status(201).json({ success: true, data: stage });
  } catch (err) {
    return res
      .status(err.statusCode || 500)
      .json({ success: false, error: err.message });
  }
};

const deactivateApprovalStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    await ApprovalService.deactivateStage(stageId);
    return res
      .status(200)
      .json({ success: true, message: "Stage deactivated" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getApprovalStages,
  addApprovalStage,
  deactivateApprovalStage,
};
