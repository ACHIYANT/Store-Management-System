"use strict";

const crypto = require("crypto");

const ASSET_CODE_PREFIX = "AST";

const normalizeText = (value) => String(value || "").trim();

const getAssetQrSecret = () =>
  normalizeText(
    process.env.ASSET_QR_SECRET ||
      process.env.STORE_ASSET_QR_SECRET ||
      process.env.MRN_SECURITY_SECRET ||
      process.env.APP_SECRET ||
      "hartron-store-assets",
  );

const buildAssetCodeSignature = ({ assetId, serialNumber }) =>
  crypto
    .createHmac("sha256", getAssetQrSecret())
    .update(`${Number(assetId) || 0}|${normalizeText(serialNumber).toUpperCase()}`)
    .digest("base64url")
    .slice(0, 12)
    .toUpperCase();

const generateAssetSecurityCode = ({ assetId, serialNumber }) => {
  const numericAssetId = Number(assetId);
  if (!Number.isFinite(numericAssetId) || numericAssetId <= 0) return "";
  const signature = buildAssetCodeSignature({
    assetId: numericAssetId,
    serialNumber,
  });
  return `${ASSET_CODE_PREFIX}-${numericAssetId}-${signature}`;
};

const parseAssetSecurityCode = (value) => {
  const text = normalizeText(value).toUpperCase();
  const match = text.match(/^AST-(\d+)-([A-Z0-9_-]{8,32})$/);
  if (!match) {
    return { valid: false, assetId: null, signature: "" };
  }

  const assetId = Number(match[1]);
  if (!Number.isFinite(assetId) || assetId <= 0) {
    return { valid: false, assetId: null, signature: "" };
  }

  return {
    valid: true,
    assetId,
    signature: match[2],
  };
};

const verifyAssetSecurityCode = (value, asset = {}) => {
  const parsed = parseAssetSecurityCode(value);
  if (!parsed.valid) return false;
  if (Number(asset?.id) !== parsed.assetId) return false;
  const expected = generateAssetSecurityCode({
    assetId: asset?.id,
    serialNumber: asset?.serial_number,
  });
  return expected === normalizeText(value).toUpperCase();
};

module.exports = {
  ASSET_CODE_PREFIX,
  generateAssetSecurityCode,
  parseAssetSecurityCode,
  verifyAssetSecurityCode,
};
