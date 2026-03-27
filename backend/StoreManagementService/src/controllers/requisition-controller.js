const { RequisitionService } = require("../services");
const {
  normalizeLimit,
  parseCursorMode,
} = require("../utils/cursor-pagination");

const service = new RequisitionService();

const parseIntOr = (value, fallback = null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {}, req.user || {});
    return res.status(201).json({
      success: true,
      message: "Requisition created successfully",
      data,
      err: {},
    });
  } catch (error) {
    console.error("RequisitionController.create error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to create requisition",
      data: {},
      err: error,
    });
  }
};

const list = async (req, res) => {
  try {
    const {
      scope = "my",
      page = 1,
      limit = 50,
      cursor = null,
      cursorMode = "false",
      status = "",
      search = "",
      fromDate = "",
      toDate = "",
    } = req.query || {};

    const result = await service.list(
      {
        scope,
        page: parseIntOr(page, 1),
        limit: normalizeLimit(limit, 50, 500),
        cursor: cursor ? String(cursor) : null,
        cursorMode: parseCursorMode(cursorMode),
        status: status || "",
        search: search || "",
        fromDate: fromDate || "",
        toDate: toDate || "",
      },
      req.user || {},
    );

    return res.status(200).json({
      success: true,
      message: "Requisitions fetched successfully",
      data: result.rows || [],
      meta: result.meta || {},
      err: {},
    });
  } catch (error) {
    console.error("RequisitionController.list error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to fetch requisitions",
      data: [],
      meta: {},
      err: error,
    });
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id, req.user || {});
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Requisition not found",
        data: {},
        err: {},
      });
    }

    return res.status(200).json({
      success: true,
      message: "Requisition fetched successfully",
      data,
      err: {},
    });
  } catch (error) {
    console.error("RequisitionController.getById error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to fetch requisition",
      data: {},
      err: error,
    });
  }
};

const approve = async (req, res) => {
  try {
    const data = await service.approve(req.params.id, req.body || {}, req.user || {});
    return res.status(200).json({
      success: true,
      message: "Requisition approved successfully",
      data,
      err: {},
    });
  } catch (error) {
    console.error("RequisitionController.approve error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to approve requisition",
      data: {},
      err: error,
    });
  }
};

const reject = async (req, res) => {
  try {
    const data = await service.reject(req.params.id, req.body || {}, req.user || {});
    return res.status(200).json({
      success: true,
      message: "Requisition rejected successfully",
      data,
      err: {},
    });
  } catch (error) {
    console.error("RequisitionController.reject error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to reject requisition",
      data: {},
      err: error,
    });
  }
};

const submit = async (req, res) => {
  try {
    const data = await service.submit(req.params.id, req.body || {}, req.user || {});
    return res.status(200).json({
      success: true,
      message: "Requisition submitted successfully",
      data,
      err: {},
    });
  } catch (error) {
    console.error("RequisitionController.submit error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to submit requisition",
      data: {},
      err: error,
    });
  }
};

const cancel = async (req, res) => {
  try {
    const data = await service.cancel(req.params.id, req.body || {}, req.user || {});
    return res.status(200).json({
      success: true,
      message: "Requisition cancelled successfully",
      data,
      err: {},
    });
  } catch (error) {
    console.error("RequisitionController.cancel error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to cancel requisition",
      data: {},
      err: error,
    });
  }
};

const mapItems = async (req, res) => {
  try {
    const data = await service.mapItems(req.params.id, req.body || {}, req.user || {});
    return res.status(200).json({
      success: true,
      message: "Requisition item mapping saved successfully",
      data,
      err: {},
    });
  } catch (error) {
    console.error("RequisitionController.mapItems error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to map requisition items",
      data: {},
      err: error,
    });
  }
};

const addAttachment = async (req, res) => {
  try {
    const fileUrl = req.encryptedFileUrl || req.body?.fileUrl || null;
    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        message: "No attachment file provided",
        data: {},
        err: {},
      });
    }

    const data = await service.addAttachment(
      req.params.id,
      {
        actionId: req.body?.actionId || null,
        attachmentType: req.body?.attachmentType || "Supporting",
        fileUrl,
        fileName: req.file?.originalname || req.body?.fileName || null,
        mimeType: req.file?.mimetype || req.body?.mimeType || null,
      },
      req.user || {},
    );

    return res.status(201).json({
      success: true,
      message: "Attachment added successfully",
      data,
      err: {},
    });
  } catch (error) {
    console.error("RequisitionController.addAttachment error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to add attachment",
      data: {},
      err: error,
    });
  }
};

const listForIssue = async (req, res) => {
  try {
    const {
      employeeId = null,
      search = "",
      cursor = null,
      cursorMode = "false",
      limit = 50,
    } = req.query || {};

    const result = await service.listForIssue(
      {
        employeeId,
        search,
        cursor: cursor ? String(cursor) : null,
        cursorMode: parseCursorMode(cursorMode),
        limit: normalizeLimit(limit, 50, 500),
      },
      req.user || {},
    );

    return res.status(200).json({
      success: true,
      message: "Issue-ready requisitions fetched successfully",
      data: result.rows || [],
      meta: result.meta || {},
      err: {},
    });
  } catch (error) {
    console.error("RequisitionController.listForIssue error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to fetch issue-ready requisitions",
      data: [],
      meta: {},
      err: error,
    });
  }
};

const getUserDashboardSummary = async (req, res) => {
  try {
    const result = await service.getUserDashboardSummary(
      {
        queueLimit: parseIntOr(req.query?.queueLimit, 8),
        historyLimit: parseIntOr(req.query?.historyLimit, 8),
        recentLimit: parseIntOr(req.query?.recentLimit, 8),
        actionNeededLimit: parseIntOr(req.query?.actionNeededLimit, 6),
        months: parseIntOr(req.query?.months, 6),
      },
      req.user || {},
    );

    return res.status(200).json({
      success: true,
      message: "User dashboard summary fetched successfully",
      data: result,
      err: {},
    });
  } catch (error) {
    console.error("RequisitionController.getUserDashboardSummary error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to fetch user dashboard summary",
      data: {},
      err: error,
    });
  }
};

module.exports = {
  create,
  list,
  getById,
  approve,
  reject,
  submit,
  cancel,
  mapItems,
  addAttachment,
  listForIssue,
  getUserDashboardSummary,
};
