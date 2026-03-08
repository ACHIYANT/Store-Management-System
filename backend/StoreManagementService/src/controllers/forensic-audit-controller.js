"use strict";

const { forensicAuditService } = require("../services/forensic-audit-service");

const listLogs = async (req, res) => {
  try {
    const result = await forensicAuditService.searchLogs(req.query || {});
    return res.status(200).json({
      success: true,
      message: "Forensic audit logs fetched successfully",
      data: result,
      err: {},
    });
  } catch (error) {
    console.error("ForensicAuditController.listLogs error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch forensic audit logs",
      data: {},
      err: {},
    });
  }
};

const listArchives = async (req, res) => {
  try {
    const result = await forensicAuditService.listArchives(req.query || {});
    return res.status(200).json({
      success: true,
      message: "Forensic audit archives fetched successfully",
      data: result,
      err: {},
    });
  } catch (error) {
    console.error("ForensicAuditController.listArchives error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch forensic audit archives",
      data: {},
      err: {},
    });
  }
};

const runMaintenance = async (_req, res) => {
  try {
    const result = await forensicAuditService.runMaintenance();
    return res.status(200).json({
      success: true,
      message: "Forensic audit maintenance completed",
      data: result,
      err: {},
    });
  } catch (error) {
    console.error("ForensicAuditController.runMaintenance error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to run forensic audit maintenance",
      data: {},
      err: {},
    });
  }
};

module.exports = {
  listLogs,
  listArchives,
  runMaintenance,
};

