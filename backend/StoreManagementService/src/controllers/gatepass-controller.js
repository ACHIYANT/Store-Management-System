const { GatePassService } = require("../services/index");
const service = new GatePassService();
const {
  normalizeLimit,
  parseCursorMode,
} = require("../utils/cursor-pagination");

const list = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      cursor = null,
      cursorMode = "false",
      search = "",
      status = "",
    } = req.query || {};

    const data = await service.list({
      page: Number(page),
      limit: normalizeLimit(limit, 20, 100),
      cursor: cursor ? String(cursor) : null,
      cursorMode: parseCursorMode(cursorMode),
      search,
      status,
    });

    return res.status(200).json({
      success: true,
      message: "Gate passes fetched successfully",
      data: data.rows || [],
      meta: data.meta || {},
      err: {},
    });
  } catch (error) {
    console.error("GatePassController.list error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch gate passes",
      data: [],
      meta: {},
      err: error,
    });
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Gate pass not found",
        data: {},
        err: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: "Gate pass fetched successfully",
      data,
      err: {},
    });
  } catch (error) {
    console.error("GatePassController.getById error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch gate pass",
      data: {},
      err: error,
    });
  }
};

const verifyByCode = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Verification code is required",
        data: {},
        err: {},
      });
    }

    const data = await service.verifyByCode(code);
    if (!data.valid) {
      return res.status(404).json({
        success: false,
        message: data.reason || "Invalid gate pass verification code",
        data,
        err: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: "Gate pass verified successfully",
      data,
      err: {},
    });
  } catch (error) {
    console.error("GatePassController.verifyByCode error:", error);
    return res.status(500).json({
      success: false,
      message: "Gate pass verification failed",
      data: {},
      err: error,
    });
  }
};

const createEWasteOutPass = async (req, res) => {
  try {
    const payload = req.body || {};
    const data = await service.createEWasteOutPass({
      assetIds: payload.assetIds || [],
      notes: payload.notes || null,
      createdBy: payload.createdBy || null,
      vendorSignatoryName: payload.vendorSignatoryName || null,
      vendorSignatoryAddress: payload.vendorSignatoryAddress || null,
      issuedSignatoryEmpId: payload.issuedSignatoryEmpId || null,
      issuedSignatoryName: payload.issuedSignatoryName || null,
      issuedSignatoryDesignation: payload.issuedSignatoryDesignation || null,
      issuedSignatoryDivision: payload.issuedSignatoryDivision || null,
    });

    return res.status(200).json({
      success: true,
      message: "E-Waste gate pass created successfully",
      data,
      err: {},
    });
  } catch (error) {
    console.error("GatePassController.createEWasteOutPass error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to create E-Waste gate pass",
      data: {},
      err: error,
    });
  }
};

const verifyOut = async (req, res) => {
  try {
    const gatePassId = Number(req.params.id);
    const { assetIds = [], verifiedBy = null } = req.body || {};
    const data = await service.verifyOut({ gatePassId, assetIds, verifiedBy });

    return res.status(200).json({
      success: true,
      message: "Gate-out verification updated",
      data,
      err: {},
    });
  } catch (error) {
    console.error("GatePassController.verifyOut error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to update gate-out verification",
      data: {},
      err: error,
    });
  }
};

const verifyIn = async (req, res) => {
  try {
    const gatePassId = Number(req.params.id);
    const { assetIds = [], verifiedBy = null } = req.body || {};
    const data = await service.verifyIn({ gatePassId, assetIds, verifiedBy });

    return res.status(200).json({
      success: true,
      message: "Gate-in verification updated",
      data,
      err: {},
    });
  } catch (error) {
    console.error("GatePassController.verifyIn error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to update gate-in verification",
      data: {},
      err: error,
    });
  }
};

const updateSignatories = async (req, res) => {
  try {
    const gatePassId = Number(req.params.id);
    const data = await service.updateSignatories({
      gatePassId,
      payload: req.body || {},
    });

    return res.status(200).json({
      success: true,
      message: "Gate pass signatories updated",
      data,
      err: {},
    });
  } catch (error) {
    console.error("GatePassController.updateSignatories error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to update gate pass signatories",
      data: {},
      err: error,
    });
  }
};

module.exports = {
  list,
  getById,
  verifyByCode,
  createEWasteOutPass,
  verifyOut,
  verifyIn,
  updateSignatories,
};
