"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mime = require("mime-types");
const { PassThrough } = require("stream");

const FILE_SECRET =
  process.env.FILE_ENCRYPTION_SECRET ||
  process.env.FILE_ENCRYPTION_KEY;

if (!FILE_SECRET || String(FILE_SECRET).trim().length < 32) {
  throw new Error(
    "FILE_ENCRYPTION_SECRET (or FILE_ENCRYPTION_KEY) must be configured with at least 32 characters.",
  );
}
const ENCRYPTION_KEY = crypto.scryptSync(FILE_SECRET, "sms-file-encryption", 32);
const IV_LENGTH = 16;

const UPLOADS_ROOT = path.resolve(__dirname, "..", "uploads");

const resolveSafeUploadPath = (userPath) => {
  const raw = String(userPath || "").trim();
  if (!raw || raw.includes("\u0000")) return null;
  if (path.isAbsolute(raw)) return null;

  const normalized = raw.replace(/^\/+/, "");
  const absolutePath = path.resolve(UPLOADS_ROOT, normalized);
  if (
    absolutePath !== UPLOADS_ROOT &&
    !absolutePath.startsWith(`${UPLOADS_ROOT}${path.sep}`)
  ) {
    return null;
  }
  return absolutePath;
};

const viewDecryptedImage = (req, res) => {
  const requestedPath = req.query.path;
  const absolutePath = resolveSafeUploadPath(requestedPath);

  if (!absolutePath) {
    return res.status(400).json({
      success: false,
      message: "Invalid file path",
      data: {},
      err: {},
    });
  }

  if (!absolutePath.endsWith(".enc")) {
    return res.status(400).json({
      success: false,
      message: "Unsupported file type",
      data: {},
      err: {},
    });
  }

  if (!fs.existsSync(absolutePath)) {
    return res.status(404).json({
      success: false,
      message: "File not found",
      data: {},
      err: {},
    });
  }

  try {
    const encryptedData = fs.readFileSync(absolutePath);
    if (encryptedData.length <= IV_LENGTH) {
      return res.status(400).json({
        success: false,
        message: "Invalid encrypted file",
        data: {},
        err: {},
      });
    }

    const iv = encryptedData.subarray(0, IV_LENGTH);
    const encrypted = encryptedData.subarray(IV_LENGTH);

    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    const originalName = absolutePath.replace(/\.enc$/i, "");
    const ext = path.extname(originalName);
    const mimeType = mime.lookup(ext) || "application/octet-stream";

    const readable = new PassThrough();
    readable.end(decrypted);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-store");
    return readable.pipe(res);
  } catch (error) {
    console.error("Error decrypting file:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Failed to decrypt file",
      data: {},
      err: {},
    });
  }
};

module.exports = { viewDecryptedImage };
