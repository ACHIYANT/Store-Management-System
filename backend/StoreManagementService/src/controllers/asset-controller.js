const { AssetService } = require("../services/index");
const service = new AssetService();

const parseAssetIds = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((v) => Number(v)).filter(Number.isFinite))];
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map((v) => Number(v)).filter(Number.isFinite))];
      }
    } catch {
      // fall through to CSV parsing
    }

    return [
      ...new Set(
        text
          .split(",")
          .map((v) => Number(v.trim()))
          .filter(Number.isFinite),
      ),
    ];
  }

  if (value == null) return [];

  const n = Number(value);
  return Number.isFinite(n) ? [n] : [];
};

const parseOptionalNumber = (value) => {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const parseOptionalText = (value) => {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
};

const buildAssetActionPayload = (req, { includeType = false } = {}) => {
  const payload = {
    assetIds: parseAssetIds(req?.body?.assetIds),
    notes: parseOptionalText(req?.body?.notes),
    approvalDocumentUrl: req?.encryptedFileUrl || null,
  };

  const fromEmployeeId = parseOptionalNumber(req?.body?.fromEmployeeId);
  const toEmployeeId = parseOptionalNumber(req?.body?.toEmployeeId);
  if (fromEmployeeId !== undefined) payload.fromEmployeeId = fromEmployeeId;
  if (toEmployeeId !== undefined) payload.toEmployeeId = toEmployeeId;

  const createdBy = parseOptionalText(req?.body?.createdBy);
  if (createdBy !== undefined) payload.createdBy = createdBy;

  if (includeType) {
    payload.type = parseOptionalText(req?.body?.type);
  }

  return payload;
};

const finalizeApprovedDaybook = async (req, res) => {
  try {
    const { daybookId } = req.params;
    const data = await service.finalizeApprovedDaybook(daybookId);
    return res.status(200).json({
      data,
      success: true,
      message: "Finalized approval: created assets and Created events",
      err: {},
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to finalize daybook approval",
      err: error,
    });
  }
};

const getInStoreByStock = async (req, res) => {
  try {
    const { stockId } = req.params;
    const result = await service.getInStoreByStock(stockId, req.query || {});
    const data = Array.isArray(result) ? result : result?.rows || [];
    const meta = Array.isArray(result) ? null : result?.meta || null;
    return res.status(200).json({
      data,
      ...(meta ? { meta } : {}),
      success: true,
      message: "Fetched in-store assets for stock",
      err: {},
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to fetch in-store assets",
      err: error,
    });
  }
};
const getAll = async (req, res) => {
  try {
    const data = await service.getAll();
    return res
      .status(200)
      .json({ data, success: true, message: "Fetched assets", err: {} });
  } catch (e) {
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to fetch assets",
      err: e,
    });
  }
};
const getByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const data = await service.getByEmployee(employeeId);
    return res.status(200).json({
      data,
      success: true,
      message: "Fetched assets by employee",
      err: {},
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to fetch assets by employee",
      err: error,
    });
  }
};

const returnAssets = async (req, res) => {
  try {
    const payload = buildAssetActionPayload(req);
    if (!payload.assetIds.length) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "Valid assetIds[] is required",
        err: {},
      });
    }
    if (!payload.approvalDocumentUrl) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "Approval document is required",
        err: {},
      });
    }

    const data = await service.returnAssets(payload); // { assetIds, fromEmployeeId?, notes? }
    return res.status(200).json({
      data,
      success: true,
      message: "Assets returned to store",
      err: {},
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to return assets",
      err: error,
    });
  }
};

const transferAssets = async (req, res) => {
  try {
    const payload = buildAssetActionPayload(req);
    if (!payload.assetIds.length) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "Valid assetIds[] is required",
        err: {},
      });
    }
    if (!payload.approvalDocumentUrl) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "Approval document is required",
        err: {},
      });
    }

    const data = await service.transferAssets(payload); // { assetIds, fromEmployeeId?, toEmployeeId, notes? }
    return res.status(200).json({
      data,
      success: true,
      message: "Assets transferred",
      err: {},
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to transfer assets",
      err: error,
    });
  }
};

const repairOut = async (req, res) => {
  try {
    const payload = buildAssetActionPayload(req);
    if (!payload.assetIds.length) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "Valid assetIds[] is required",
        err: {},
      });
    }
    if (!payload.approvalDocumentUrl) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "Approval document is required",
        err: {},
      });
    }

    const data = await service.repairOut(payload); // { assetIds, notes? }
    return res.status(200).json({
      data,
      success: true,
      message: "Assets sent to repair",
      err: {},
    });
  } catch (error) {
    console.error(error);
    const errMessage =
      error?.message || error?.error?.message || "Failed to send to repair";
    return res.status(500).json({
      data: {},
      success: false,
      message: errMessage,
      err: error?.error || error,
    });
  }
};

const repairIn = async (req, res) => {
  try {
    const payload = buildAssetActionPayload(req);
    if (!payload.assetIds.length) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "Valid assetIds[] is required",
        err: {},
      });
    }

    const data = await service.repairIn(payload); // { assetIds, notes? }
    return res.status(200).json({
      data,
      success: true,
      message: "Assets received from repair",
      err: {},
    });
  } catch (error) {
    console.error(error);
    const errMessage =
      error?.message || error?.error?.message || "Failed to receive from repair";
    return res.status(500).json({
      data: {},
      success: false,
      message: errMessage,
      err: error?.error || error,
    });
  }
};

const finalize = async (req, res) => {
  try {
    const payload = buildAssetActionPayload(req, { includeType: true });
    if (!payload.assetIds.length) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "Valid assetIds[] is required",
        err: {},
      });
    }
    if (!payload.approvalDocumentUrl) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "Approval document is required",
        err: {},
      });
    }

    const data = await service.finalize(payload); // { assetIds, type: "Disposed"|"Lost"|"EWaste", notes? }
    return res.status(200).json({
      data,
      success: true,
      message: "Assets finalized",
      err: {},
    });
  } catch (error) {
    console.error(error);
    const errMessage =
      error?.message || error?.error?.message || "Failed to finalize assets";
    return res.status(500).json({
      data: {},
      success: false,
      message: errMessage,
      err: error?.error || error,
    });
  }
};

const retainAssets = async (req, res) => {
  try {
    const payload = buildAssetActionPayload(req);
    if (!payload.assetIds.length) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "Valid assetIds[] is required",
        err: {},
      });
    }
    if (!payload.approvalDocumentUrl) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "Approval document is required",
        err: {},
      });
    }

    const data = await service.retain(payload);
    return res.status(200).json({
      data,
      success: true,
      message: "Assets marked as retained",
      err: {},
    });
  } catch (error) {
    console.error(error);
    const errMessage =
      error?.message || error?.error?.message || "Failed to retain assets";
    return res.status(500).json({
      data: {},
      success: false,
      message: errMessage,
      err: error?.error || error,
    });
  }
};

/* =====================================
   ✅ GET /api/v1/assets-by-category
===================================== */
const getAssetsByCategorySummary = async (req, res) => {
  try {
    const result = await service.getAssetsGroupedByCategory(req.query || {});
    const data = Array.isArray(result) ? result : result?.rows || [];
    const meta = Array.isArray(result) ? null : result?.meta || null;
    return res.status(200).json({
      success: true,
      data,
      ...(meta ? { meta } : {}),
    });
  } catch (error) {
    console.error("getAssetsByCategorySummary error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch asset categories",
    });
  }
};

/* =====================================
   ✅ GET /api/v1/assets/by-category/:id
===================================== */
const getAssetsByCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await service.getAssetsByCategory(id, req.query || {});
    const data = Array.isArray(result) ? result : result?.rows || [];
    const meta = Array.isArray(result) ? null : result?.meta || null;

    return res.status(200).json({
      success: true,
      data,
      ...(meta ? { meta } : {}),
    });
  } catch (error) {
    console.error("getAssetsByCategory error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assets by category",
    });
  }
};

const getAssets = async (req, res) => {
  try {
    const result = await service.getAssets(req.query);
    return res.json({
      success: true,
      data: result.rows,
      meta: result.meta,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assets",
    });
  }
};

module.exports = {
  finalizeApprovedDaybook,
  getInStoreByStock,
  getByEmployee,
  returnAssets,
  transferAssets,
  repairOut,
  repairIn,
  finalize,
  retainAssets,
  getAll,
  getAssetsByCategorySummary,
  getAssetsByCategory,
  getAssets,
};
