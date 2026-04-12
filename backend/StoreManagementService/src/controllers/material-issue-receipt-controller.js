"use strict";

const MaterialIssueReceiptService = require("../services/material-issue-receipt-service");
const {
  normalizeLimit,
  parseCursorMode,
} = require("../utils/cursor-pagination");

const service = new MaterialIssueReceiptService();

const list = async (req, res) => {
  try {
    const {
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
        page: Number(page),
        limit: normalizeLimit(limit, 50, 500),
        cursor: cursor ? String(cursor) : null,
        cursorMode: parseCursorMode(cursorMode),
        status,
        search,
        fromDate,
        toDate,
      },
      req.user || {},
    );

    return res.status(200).json({
      success: true,
      message: "MIR list fetched successfully.",
      data: result.rows || [],
      meta: result.meta || {},
      err: {},
    });
  } catch (error) {
    console.error("MaterialIssueReceiptController.list error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to fetch MIR list.",
      data: [],
      meta: {},
      err: error,
    });
  }
};

const getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.mirId, req.user || {});
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "MIR not found.",
        data: {},
        err: {},
      });
    }
    return res.status(200).json({
      success: true,
      message: "MIR fetched successfully.",
      data,
      err: {},
    });
  } catch (error) {
    console.error("MaterialIssueReceiptController.getById error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to fetch MIR.",
      data: {},
      err: error,
    });
  }
};

const uploadSigned = async (req, res) => {
  try {
    const fileUrl = req.encryptedFileUrl || null;
    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        message: "No signed MIR file provided.",
        data: {},
        err: {},
      });
    }

    const data = await service.uploadSigned(
      req.params.mirId,
      fileUrl,
      req.user || {},
    );

    return res.status(200).json({
      success: true,
      message: "Signed MIR uploaded successfully.",
      data,
      err: {},
    });
  } catch (error) {
    console.error("MaterialIssueReceiptController.uploadSigned error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to upload signed MIR.",
      data: {},
      err: error,
    });
  }
};

module.exports = {
  list,
  getById,
  uploadSigned,
};
