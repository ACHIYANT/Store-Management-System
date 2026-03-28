"use strict";

const normalizeRoleList = (roles = []) =>
  Array.isArray(roles)
    ? roles
        .map((role) => String(role || "").trim().toUpperCase())
        .filter(Boolean)
    : [];

const normalizeLocationScopes = (scopes = []) =>
  Array.isArray(scopes)
    ? [
        ...new Set(
          scopes
            .map((scope) => String(scope || "").trim().toUpperCase())
            .filter(Boolean),
        ),
      ]
    : [];

const buildMigrationActorLabel = (actor = {}) => {
  const fullname = String(actor?.fullname || "").trim();
  const empcode = Number(actor?.empcode || 0);
  const userId = Number(actor?.id || actor?.user_id || 0);

  if (fullname && empcode > 0) return `${fullname} (${empcode})`;
  if (fullname) return fullname;
  if (empcode > 0) return `EMP-${empcode}`;
  if (userId > 0) return `USER-${userId}`;
  return "System Migration";
};

const buildMigrationActorMeta = (actor = {}) => ({
  requested_by: {
    user_id: Number(actor?.id || 0) || null,
    empcode: Number(actor?.empcode || 0) || null,
    fullname: String(actor?.fullname || "").trim() || null,
    roles: normalizeRoleList(actor?.roles || []),
    location_scopes: normalizeLocationScopes(actor?.location_scopes || []),
  },
});

const buildMigrationOperationContext = (actor = {}) => ({
  actorLabel: buildMigrationActorLabel(actor),
  actorMeta: buildMigrationActorMeta(actor),
});

const buildMigrationMeta = (baseMeta = {}, actor = {}) => ({
  ...(baseMeta || {}),
  ...buildMigrationActorMeta(actor),
});

const resolveMigrationErrorStatus = (error) => {
  const explicitStatus = Number(error?.statusCode || error?.status || 0);
  if (Number.isInteger(explicitStatus) && explicitStatus >= 400 && explicitStatus < 600) {
    return explicitStatus;
  }

  const message = String(error?.message || "").trim().toLowerCase();
  if (!message) return 500;

  const clientErrorPatterns = [
    "required",
    "empty",
    "not found",
    "mismatch",
    "duplicate",
    "invalid",
    "must",
    "cannot",
    "supports",
    "belongs to",
    "missing",
    "ambiguous",
    "already exists",
    "sheet",
    "location",
  ];

  return clientErrorPatterns.some((pattern) => message.includes(pattern)) ? 400 : 500;
};

module.exports = {
  buildMigrationActorLabel,
  buildMigrationMeta,
  buildMigrationOperationContext,
  resolveMigrationErrorStatus,
};
