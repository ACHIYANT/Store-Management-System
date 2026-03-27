const OrgAssignmentService = require("../services/org-assignment-service");

const list = async (req, res) => {
  try {
    const data = await OrgAssignmentService.list(req.query || {});
    return res.status(200).json({
      success: true,
      message: "Organizational assignments fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode >= 500
          ? "Unable to fetch organizational assignments"
          : error?.message || "Request failed",
      data: {},
      err: statusCode >= 500 ? {} : { message: error?.message },
    });
  }
};

const assign = async (req, res) => {
  try {
    const data = await OrgAssignmentService.assign(req.body || {}, req.user || {});
    return res.status(201).json({
      success: true,
      message: "Organizational assignment saved successfully.",
      data,
      err: {},
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode >= 500
          ? "Unable to save organizational assignment"
          : error?.message || "Request failed",
      data: {},
      err: statusCode >= 500 ? {} : { message: error?.message },
    });
  }
};

const end = async (req, res) => {
  try {
    const data = await OrgAssignmentService.end(
      req.params.assignmentId,
      req.body || {},
      req.user || {},
    );
    return res.status(200).json({
      success: true,
      message: "Organizational assignment ended successfully.",
      data,
      err: {},
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode >= 500
          ? "Unable to end organizational assignment"
          : error?.message || "Request failed",
      data: {},
      err: statusCode >= 500 ? {} : { message: error?.message },
    });
  }
};

module.exports = {
  list,
  assign,
  end,
};
