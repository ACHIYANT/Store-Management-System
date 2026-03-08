"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { Op } = require("sequelize");
const {
  ForensicAuditArchive,
  ForensicAuditLog,
  sequelize,
} = require("../models");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TEXT_SIZE = 2000;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 80;
const MAX_DEPTH = 6;

const DEFAULT_SKIP_PATHS = new Set([
  "/api/v1/healthz",
  "/api/v1/csrf-token",
  "/api/v1/isAuthenticated",
  "/api/v1/users/isAuthenticated",
  "/api/v1/forensic-audit/logs",
  "/api/v1/forensic-audit/archives",
  "/api/v1/forensic-audit/maintenance/run",
]);

const SENSITIVE_KEY_PARTS = [
  "password",
  "passwd",
  "pass",
  "secret",
  "token",
  "authorization",
  "cookie",
  "jwt",
  "csrf",
  "api_key",
  "apikey",
  "accesskey",
  "privatekey",
];

const toPositiveInt = (value, fallback) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
};

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const truncateText = (value, maxLength = MAX_TEXT_SIZE) => {
  const text = String(value ?? "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...(truncated)`;
};

const looksSensitiveKey = (key) => {
  const normalized = String(key || "").trim().toLowerCase();
  if (!normalized) return false;
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
};

const sanitizeAuditPayload = (input, depth = 0, seen = new WeakSet()) => {
  if (input === undefined) return null;
  if (input === null) return null;
  if (depth > MAX_DEPTH) return "[MaxDepth]";

  const inputType = typeof input;
  if (inputType === "string") return truncateText(input);
  if (inputType === "number") return Number.isFinite(input) ? input : null;
  if (inputType === "boolean") return input;
  if (input instanceof Date) return input.toISOString();
  if (Buffer.isBuffer(input)) return `[Buffer:${input.length}]`;

  if (Array.isArray(input)) {
    const limited = input.slice(0, MAX_ARRAY_ITEMS);
    const arr = limited.map((entry) =>
      sanitizeAuditPayload(entry, depth + 1, seen),
    );
    if (input.length > MAX_ARRAY_ITEMS) {
      arr.push(`[Truncated:${input.length - MAX_ARRAY_ITEMS}]`);
    }
    return arr;
  }

  if (input instanceof Error) {
    return {
      name: truncateText(input.name || "Error", 120),
      message: truncateText(input.message || "", 500),
    };
  }

  if (inputType === "object") {
    if (seen.has(input)) return "[Circular]";
    seen.add(input);

    const output = {};
    const keys = Object.keys(input).slice(0, MAX_OBJECT_KEYS);
    for (const key of keys) {
      if (looksSensitiveKey(key)) {
        output[key] = "[REDACTED]";
        continue;
      }
      output[key] = sanitizeAuditPayload(input[key], depth + 1, seen);
    }
    if (Object.keys(input).length > MAX_OBJECT_KEYS) {
      output.__truncated_keys = Object.keys(input).length - MAX_OBJECT_KEYS;
    }
    return output;
  }

  return truncateText(input);
};

const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const subtractDays = (date, days) => new Date(date.getTime() - days * DAY_MS);
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const parseDateInput = (value, fallback = null) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
};

const getEntityTypeFromPath = (routePath) => {
  const segments = String(routePath || "")
    .split("?")[0]
    .split("/")
    .filter(Boolean);
  const v1Index = segments.indexOf("v1");
  if (v1Index >= 0 && segments[v1Index + 1]) {
    return truncateText(segments[v1Index + 1], 80);
  }
  return segments[0] ? truncateText(segments[0], 80) : null;
};

const getEntityIdFromRequest = (req) => {
  const params = req?.params || {};
  const firstParamKey = Object.keys(params)[0];
  if (!firstParamKey) return null;
  return truncateText(params[firstParamKey], 120);
};

class ForensicAuditService {
  constructor(serviceName = "StoreManagementService") {
    this.serviceName = serviceName;
    this.enabled = toBool(process.env.FORENSIC_AUDIT_ENABLED, true);
    this.hotDays = toPositiveInt(process.env.FORENSIC_AUDIT_HOT_DAYS, 90);
    this.coldDays = toPositiveInt(process.env.FORENSIC_AUDIT_COLD_DAYS, 365);
    this.defaultSearchDays = toPositiveInt(
      process.env.FORENSIC_AUDIT_SEARCH_DEFAULT_DAYS,
      30,
    );
    this.searchMaxLimit = toPositiveInt(
      process.env.FORENSIC_AUDIT_SEARCH_MAX_LIMIT,
      500,
    );
    this.archiveBatchSize = toPositiveInt(
      process.env.FORENSIC_AUDIT_ARCHIVE_BATCH_SIZE,
      2000,
    );
    this.maxArchiveBatchesPerRun = toPositiveInt(
      process.env.FORENSIC_AUDIT_ARCHIVE_MAX_BATCHES_PER_RUN,
      5,
    );
    this.archiveIntervalMs = toPositiveInt(
      process.env.FORENSIC_AUDIT_ARCHIVE_INTERVAL_MS,
      6 * 60 * 60 * 1000,
    );
    this.archiveDir = path.resolve(
      process.cwd(),
      process.env.FORENSIC_AUDIT_ARCHIVE_DIR || "src/audit-archive",
    );
    this.skipPaths = new Set([
      ...DEFAULT_SKIP_PATHS,
      ...parseCsv(process.env.FORENSIC_AUDIT_SKIP_PATHS),
    ]);
    this.scheduler = null;
  }

  isEnabled() {
    return this.enabled;
  }

  shouldSkipPath(pathname) {
    const normalized = String(pathname || "").split("?")[0] || "/";
    if (!normalized.startsWith("/api/")) return true;
    return this.skipPaths.has(normalized);
  }

  async recordEvent(event = {}) {
    if (!this.enabled) return;
    try {
      await ForensicAuditLog.create({
        request_id: truncateText(event.requestId || "unknown", 64),
        service_name: this.serviceName,
        environment: truncateText(process.env.NODE_ENV || "development", 32),
        method: truncateText(event.method || "UNKNOWN", 10),
        route_path: truncateText(event.routePath || "/", 255),
        action: event.action ? truncateText(event.action, 160) : null,
        entity_type: event.entityType ? truncateText(event.entityType, 80) : null,
        entity_id: event.entityId ? truncateText(event.entityId, 120) : null,
        status_code: Number(event.statusCode || 0),
        success: Boolean(event.success),
        duration_ms: toPositiveInt(event.durationMs, 0),
        actor_user_id: event.actorUserId || null,
        actor_emp_code: event.actorEmpCode
          ? truncateText(event.actorEmpCode, 64)
          : null,
        actor_name: event.actorName ? truncateText(event.actorName, 255) : null,
        actor_roles: event.actorRoles ? truncateText(event.actorRoles, 255) : null,
        source_ip: event.sourceIp ? truncateText(event.sourceIp, 64) : null,
        user_agent: event.userAgent ? truncateText(event.userAgent, 512) : null,
        query_json:
          event.queryJson === undefined ? null : sanitizeAuditPayload(event.queryJson),
        request_body_json:
          event.requestBodyJson === undefined
            ? null
            : sanitizeAuditPayload(event.requestBodyJson),
        response_body_json:
          event.responseBodyJson === undefined
            ? null
            : sanitizeAuditPayload(event.responseBodyJson),
        error_message: event.errorMessage
          ? truncateText(event.errorMessage, 2000)
          : null,
        metadata_json:
          event.metadataJson === undefined
            ? null
            : sanitizeAuditPayload(event.metadataJson),
        started_at: event.startedAt || new Date(),
        completed_at: event.completedAt || new Date(),
        archived_at: null,
      });
    } catch (error) {
      const message = String(error?.message || "");
      if (
        message.includes("ForensicAuditLogs") &&
        message.toLowerCase().includes("doesn't exist")
      ) {
        this.enabled = false;
        console.error(
          "[ForensicAudit] disabled because table ForensicAuditLogs is missing. Run migrations and restart service.",
        );
        return;
      }
      console.error("ForensicAuditService.recordEvent failed:", error?.message || error);
    }
  }

  async searchLogs(filters = {}) {
    const now = new Date();
    const hotCutoff = subtractDays(now, this.hotDays);
    const requestedFrom = parseDateInput(filters.from);
    const requestedTo = parseDateInput(filters.to);

    let fromDate = requestedFrom || subtractDays(now, this.defaultSearchDays);
    let toDate = requestedTo || now;

    if (fromDate < hotCutoff) fromDate = hotCutoff;
    if (toDate > now) toDate = now;
    if (toDate < fromDate) toDate = fromDate;

    const where = {
      createdAt: {
        [Op.between]: [fromDate, toDate],
      },
    };

    if (filters.request_id) where.request_id = String(filters.request_id).trim();
    if (filters.actor_user_id !== undefined && filters.actor_user_id !== null) {
      const actorUserId = Number(filters.actor_user_id);
      if (Number.isFinite(actorUserId)) {
        where.actor_user_id = actorUserId;
      }
    }
    if (filters.status_code !== undefined && filters.status_code !== null) {
      const statusCode = Number(filters.status_code);
      if (Number.isFinite(statusCode)) {
        where.status_code = statusCode;
      }
    }
    if (filters.method) where.method = String(filters.method).trim().toUpperCase();
    if (filters.entity_type) {
      where.entity_type = {
        [Op.like]: `%${String(filters.entity_type).trim()}%`,
      };
    }
    if (filters.entity_id) {
      where.entity_id = {
        [Op.like]: `%${String(filters.entity_id).trim()}%`,
      };
    }
    if (filters.action) {
      where.action = {
        [Op.like]: `%${String(filters.action).trim()}%`,
      };
    }
    if (filters.actor_emp_code) {
      where.actor_emp_code = {
        [Op.like]: `%${String(filters.actor_emp_code).trim()}%`,
      };
    }
    if (filters.actor_name) {
      where.actor_name = {
        [Op.like]: `%${String(filters.actor_name).trim()}%`,
      };
    }

    if (filters.q) {
      const likeValue = `%${String(filters.q).trim()}%`;
      where[Op.and] = where[Op.and] || [];
      where[Op.and].push({
        [Op.or]: [
          { action: { [Op.like]: likeValue } },
          { route_path: { [Op.like]: likeValue } },
          { entity_type: { [Op.like]: likeValue } },
          { entity_id: { [Op.like]: likeValue } },
          { actor_name: { [Op.like]: likeValue } },
          { actor_emp_code: { [Op.like]: likeValue } },
          { source_ip: { [Op.like]: likeValue } },
          { request_id: { [Op.like]: likeValue } },
          { error_message: { [Op.like]: likeValue } },
        ],
      });
    }

    const limit = Math.min(
      toPositiveInt(filters.limit, 100),
      this.searchMaxLimit,
    );
    const offset = toPositiveInt(filters.offset, 0);
    const includePayload = toBool(filters.include_payload, false);

    const attributes = includePayload
      ? undefined
      : {
          exclude: ["query_json", "request_body_json", "response_body_json", "metadata_json"],
        };

    const result = await ForensicAuditLog.findAndCountAll({
      where,
      attributes,
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit,
      offset,
    });

    return {
      filters: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        limit,
        offset,
        include_payload: includePayload,
      },
      total: Number(result.count || 0),
      rows: Array.isArray(result.rows) ? result.rows : [],
    };
  }

  async listArchives(filters = {}) {
    const limit = Math.min(
      toPositiveInt(filters.limit, 100),
      this.searchMaxLimit,
    );
    const offset = toPositiveInt(filters.offset, 0);

    const result = await ForensicAuditArchive.findAndCountAll({
      order: [
        ["id", "DESC"],
        ["archived_at", "DESC"],
      ],
      limit,
      offset,
    });

    return {
      total: Number(result.count || 0),
      limit,
      offset,
      rows: Array.isArray(result.rows) ? result.rows : [],
    };
  }

  async ensureArchiveDir() {
    await fs.promises.mkdir(this.archiveDir, { recursive: true });
  }

  async archiveOneBatch() {
    if (!this.enabled) return { archivedCount: 0, archived: false };
    await this.ensureArchiveDir();

    const cutoff = subtractDays(new Date(), this.hotDays);
    const rows = await ForensicAuditLog.findAll({
      where: {
        createdAt: { [Op.lt]: cutoff },
      },
      order: [["id", "ASC"]],
      limit: this.archiveBatchSize,
      raw: true,
    });

    if (!rows.length) {
      return { archivedCount: 0, archived: false };
    }

    const first = rows[0];
    const last = rows[rows.length - 1];
    const archiveMoment = new Date();
    const fileName = `forensic-audit-${archiveMoment
      .toISOString()
      .replace(/[:.]/g, "-")}-${first.id}-${last.id}.ndjson.gz`;
    const archiveFilePath = path.join(this.archiveDir, fileName);
    const archiveContent = `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
    const archiveBuffer = zlib.gzipSync(Buffer.from(archiveContent, "utf8"), {
      level: zlib.constants.Z_BEST_SPEED,
    });
    const checksum = crypto
      .createHash("sha256")
      .update(archiveBuffer)
      .digest("hex");

    await fs.promises.writeFile(archiveFilePath, archiveBuffer);

    const ids = rows.map((row) => row.id);

    try {
      await sequelize.transaction(async (transaction) => {
        await ForensicAuditArchive.create(
          {
            archive_file_name: fileName,
            archive_file_path: archiveFilePath,
            checksum_sha256: checksum,
            record_count: rows.length,
            first_log_id: first.id,
            last_log_id: last.id,
            first_event_at: first.createdAt || first.started_at || null,
            last_event_at: last.createdAt || last.completed_at || null,
            archived_at: archiveMoment,
            expires_at: addDays(archiveMoment, this.coldDays),
          },
          { transaction },
        );

        await ForensicAuditLog.destroy({
          where: { id: { [Op.in]: ids } },
          transaction,
        });
      });
    } catch (error) {
      await fs.promises.unlink(archiveFilePath).catch(() => {});
      throw error;
    }

    return {
      archived: true,
      archivedCount: rows.length,
      archiveFileName: fileName,
      firstLogId: first.id,
      lastLogId: last.id,
    };
  }

  async purgeExpiredArchives() {
    if (!this.enabled) return { purgedCount: 0 };

    const now = new Date();
    const expiredRows = await ForensicAuditArchive.findAll({
      where: {
        expires_at: {
          [Op.lte]: now,
        },
      },
      order: [["id", "ASC"]],
      limit: this.archiveBatchSize,
      raw: true,
    });

    if (!expiredRows.length) {
      return { purgedCount: 0 };
    }

    let purgedCount = 0;
    for (const row of expiredRows) {
      if (row.archive_file_path) {
        await fs.promises.unlink(row.archive_file_path).catch(() => {});
      }
      await ForensicAuditArchive.destroy({ where: { id: row.id } });
      purgedCount += 1;
    }

    return { purgedCount };
  }

  async runMaintenance() {
    if (!this.enabled) {
      return {
        enabled: false,
        archivedCount: 0,
        archivedBatches: 0,
        purgedArchives: 0,
      };
    }

    let archivedCount = 0;
    let archivedBatches = 0;
    for (let i = 0; i < this.maxArchiveBatchesPerRun; i += 1) {
      const batch = await this.archiveOneBatch();
      if (!batch.archived) break;
      archivedCount += batch.archivedCount;
      archivedBatches += 1;
    }

    const purgeResult = await this.purgeExpiredArchives();

    return {
      enabled: true,
      archivedCount,
      archivedBatches,
      purgedArchives: purgeResult.purgedCount || 0,
    };
  }

  startScheduler() {
    if (!this.enabled) {
      console.log("[ForensicAudit] disabled by FORENSIC_AUDIT_ENABLED=false");
      return;
    }
    if (this.scheduler) return;

    this.scheduler = setInterval(() => {
      this.runMaintenance().catch((error) => {
        console.error("[ForensicAudit] maintenance failed:", error?.message || error);
      });
    }, this.archiveIntervalMs);

    this.scheduler.unref();

    setTimeout(() => {
      this.runMaintenance().catch((error) => {
        console.error("[ForensicAudit] initial maintenance failed:", error?.message || error);
      });
    }, 30_000).unref();
  }
}

const forensicAuditService = new ForensicAuditService("StoreManagementService");

module.exports = {
  ForensicAuditService,
  forensicAuditService,
  sanitizeAuditPayload,
  truncateText,
  getEntityIdFromRequest,
  getEntityTypeFromPath,
};
