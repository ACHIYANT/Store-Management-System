"use strict";

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const IV_LENGTH = 16;
const DEFAULT_UPLOAD_MAX_BYTES = 20 * 1024 * 1024; // 20 MB

const FILE_SECRET =
  process.env.FILE_ENCRYPTION_SECRET ||
  process.env.FILE_ENCRYPTION_KEY;

if (!FILE_SECRET || String(FILE_SECRET).trim().length < 32) {
  throw new Error(
    "FILE_ENCRYPTION_SECRET (or FILE_ENCRYPTION_KEY) must be configured with at least 32 characters.",
  );
}

const ENCRYPTION_KEY = crypto.scryptSync(FILE_SECRET, "sms-file-encryption", 32);

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".pdf",
  ".xlsx",
  ".xls",
]);

const ALLOWED_MIGRATION_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

const ALLOWED_MIGRATION_EXTENSIONS = new Set([".xlsx", ".xls"]);

const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const sanitizeSegment = (value) => {
  const raw = String(value || "").trim();
  const normalized = raw.replace(/[^\w.-]+/g, "_");
  return normalized || "unknown";
};

const pickExtension = (originalName) => {
  const ext = String(path.extname(originalName || "") || "").toLowerCase();
  return ext && ext.length <= 10 ? ext : "";
};

const isAllowedFile = (file, { mimeTypes, extensions }) => {
  const mimeType = String(file?.mimetype || "").toLowerCase();
  const ext = pickExtension(file?.originalname);
  return mimeTypes.has(mimeType) && extensions.has(ext);
};

const encryptAndSave = (buffer, destinationPath) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  fs.writeFileSync(destinationPath, Buffer.concat([iv, encrypted]));
};

const secureMemoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: Number(process.env.UPLOAD_MAX_FILE_BYTES || DEFAULT_UPLOAD_MAX_BYTES),
    fields: 100,
  },
  fileFilter: (_req, file, cb) => {
    if (
      isAllowedFile(file, {
        mimeTypes: ALLOWED_UPLOAD_MIME_TYPES,
        extensions: ALLOWED_UPLOAD_EXTENSIONS,
      })
    ) {
      return cb(null, true);
    }
    return cb(
      new multer.MulterError("LIMIT_UNEXPECTED_FILE", file?.fieldname || "file"),
    );
  },
});

const buildEncryptedUploadMiddleware = (folderName, typeLabel) => [
  secureMemoryUpload.single("file"),
  (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
        data: {},
        err: {},
      });
    }

    const uploadDir = path.join(__dirname, "..", "uploads", folderName);
    ensureDirectory(uploadDir);

    const entryNo = sanitizeSegment(req.body.entry_no);
    const billNo = sanitizeSegment(req.body.bill_no);
    const ext = pickExtension(req.file.originalname);
    const filename = `${entryNo}_${billNo}_${typeLabel}_${Date.now()}${ext}.enc`;
    const destinationPath = path.join(uploadDir, filename);

    encryptAndSave(req.file.buffer, destinationPath);
    req.encryptedFileUrl = `/uploads/${folderName}/${filename}`;
    return next();
  },
];

const migrationUploadDir = path.join(__dirname, "..", "uploads", "migration-temp");
ensureDirectory(migrationUploadDir);

const migrationStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, migrationUploadDir),
  filename: (_req, file, cb) => {
    const ext = pickExtension(file?.originalname) || ".xlsx";
    const safeName = `migration_${Date.now()}_${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  },
});

const uploadMigrationSpreadsheet = multer({
  storage: migrationStorage,
  limits: {
    files: 1,
    fileSize: Number(
      process.env.MIGRATION_MAX_FILE_BYTES || 30 * 1024 * 1024, // 30 MB
    ),
    fields: 100,
  },
  fileFilter: (_req, file, cb) => {
    if (
      isAllowedFile(file, {
        mimeTypes: ALLOWED_MIGRATION_MIME_TYPES,
        extensions: ALLOWED_MIGRATION_EXTENSIONS,
      })
    ) {
      return cb(null, true);
    }
    return cb(
      new multer.MulterError("LIMIT_UNEXPECTED_FILE", file?.fieldname || "file"),
    );
  },
}).single("file");

module.exports = {
  uploadEncryptedBill: buildEncryptedUploadMiddleware("bills", "bill"),
  uploadEncryptedItem: buildEncryptedUploadMiddleware("items", "item"),
  uploadEncryptedMir: buildEncryptedUploadMiddleware("mirs", "mir"),
  uploadEncryptedRequisition: buildEncryptedUploadMiddleware(
    "requisitions",
    "requisition",
  ),
  uploadMigrationSpreadsheet,
};
