"use strict";

const AssetVerificationService = require("../services/asset-verification-service");

const service = new AssetVerificationService();

async function verifyAsset(req, res) {
  try {
    const { code } = req.query;
    if (!String(code || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Verification code is required.",
      });
    }

    const result = await service.verifyByCode(code, req.user || null);

    return res.status(result.valid ? 200 : 404).json({
      success: result.valid,
      data: result,
    });
  } catch (error) {
    console.error("AssetVerificationController.verifyAsset error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: "Asset verification failed.",
      err: error,
    });
  }
}

module.exports = {
  verifyAsset,
};
