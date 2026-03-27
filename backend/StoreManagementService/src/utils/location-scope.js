"use strict";

const { Op } = require("sequelize");
const { Employee, Custodian } = require("../models");

const LOCATION_SCOPE_FIELD = "location_scope";
const NO_LOCATION_ACCESS_SCOPE = "__NO_LOCATION_ACCESS__";

const createLocationError = (message, statusCode = 403) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeRoleList = (roles = []) =>
  Array.isArray(roles)
    ? roles
        .map((role) => String(role || "").trim().toUpperCase())
        .filter(Boolean)
    : [];

const normalizeLocationScope = (value) => {
  if (value == null) return null;
  const text = String(value).trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.toUpperCase();
};

const getLocationScopeFromResolvedCustodian = (custodian = null) =>
  normalizeLocationScope(custodian?.location || null);

const getLocationScopeFromLocationText = (value) =>
  normalizeLocationScope(value);

const collectActorLocationScopes = (actor = {}) => {
  const roles = normalizeRoleList(actor?.roles || []);
  if (roles.includes("SUPER_ADMIN")) {
    return {
      unrestricted: true,
      scopes: [],
    };
  }

  const assignments = Array.isArray(actor?.assignments) ? actor.assignments : [];
  const scopes = new Set();
  let unrestricted = false;

  const actorLevelCandidates = [];
  if (Array.isArray(actor?.location_scopes)) {
    actorLevelCandidates.push(...actor.location_scopes);
  }
  if (actor?.office_location_scope) actorLevelCandidates.push(actor.office_location_scope);
  if (actor?.office_location) actorLevelCandidates.push(actor.office_location);
  if (actor?.location_scope) actorLevelCandidates.push(actor.location_scope);

  for (const candidate of actorLevelCandidates) {
    const normalized = normalizeLocationScope(candidate);
    if (normalized) scopes.add(normalized);
  }

  for (const assignment of assignments) {
    const assignmentType = String(assignment?.assignment_type || "")
      .trim()
      .toUpperCase();
    const scopeType = String(assignment?.scope_type || "")
      .trim()
      .toUpperCase();
    const metadata =
      assignment?.metadata_json && typeof assignment.metadata_json === "object"
        ? assignment.metadata_json
        : {};

    if (assignmentType === "GLOBAL" || scopeType === "GLOBAL") {
      unrestricted = true;
    }

    const candidates = [];
    if (metadata?.location) candidates.push(metadata.location);
    if (scopeType === "LOCATION") {
      candidates.push(assignment?.scope_label);
      candidates.push(assignment?.scope_key);
    }

    for (const candidate of candidates) {
      const normalized = normalizeLocationScope(candidate);
      if (normalized) scopes.add(normalized);
    }
  }

  return {
    unrestricted,
    scopes: [...scopes],
  };
};

const assertActorCanAccessLocation = (
  actor = {},
  locationScope,
  actionLabel = "access this location",
) => {
  const normalizedScope = normalizeLocationScope(locationScope);
  if (!normalizedScope) {
    throw createLocationError(
      "Location scope is missing on this record. Please backfill the location before continuing.",
      409,
    );
  }

  const access = collectActorLocationScopes(actor);
  if (access.unrestricted) return normalizedScope;

  if (!access.scopes.length) {
    throw createLocationError(
      "Your account is not assigned to any location. Please ask a super admin to assign one.",
    );
  }

  if (!access.scopes.includes(normalizedScope)) {
    throw createLocationError(
      `You can ${actionLabel} only for your assigned location.`,
    );
  }

  return normalizedScope;
};

const resolveActorLocationScope = (
  actor = {},
  requestedLocationScope = null,
  fieldLabel = LOCATION_SCOPE_FIELD,
) => {
  const requested = normalizeLocationScope(requestedLocationScope);
  const access = collectActorLocationScopes(actor);

  if (requested) {
    return assertActorCanAccessLocation(actor, requested, `use ${fieldLabel}`);
  }

  if (access.unrestricted) {
    if (access.scopes.length === 1) return access.scopes[0];
    throw createLocationError(
      `${fieldLabel} is required for multi-location or unrestricted accounts.`,
      400,
    );
  }

  if (!access.scopes.length) {
    throw createLocationError(
      "Your account is not assigned to any location. Please ask a super admin to assign one.",
    );
  }

  if (access.scopes.length > 1) {
    throw createLocationError(
      `${fieldLabel} is required because your account is assigned to multiple locations.`,
      400,
    );
  }

  return access.scopes[0];
};

const buildLocationScopeWhere = (
  actor = {},
  fieldName = LOCATION_SCOPE_FIELD,
) => {
  const access = collectActorLocationScopes(actor);
  if (access.unrestricted) return null;
  if (!access.scopes.length) {
    return {
      [fieldName]: NO_LOCATION_ACCESS_SCOPE,
    };
  }

  return {
    [fieldName]: {
      [Op.in]: access.scopes,
    },
  };
};

const mergeLocationScopeIntoWhere = (
  where = {},
  actor = {},
  fieldName = LOCATION_SCOPE_FIELD,
) => {
  const locationWhere = buildLocationScopeWhere(actor, fieldName);
  if (!locationWhere) return where;
  return {
    ...where,
    ...locationWhere,
  };
};

const resolveEmployeeLocationScope = async (
  employeeId,
  { transaction = null } = {},
) => {
  const employeeIdNum = Number(employeeId);
  if (!Number.isFinite(employeeIdNum) || employeeIdNum <= 0) return null;
  const employee = await Employee.findByPk(employeeIdNum, {
    attributes: ["emp_id", "office_location"],
    transaction: transaction || undefined,
  });
  return normalizeLocationScope(employee?.office_location || null);
};

const resolveCustodianLocationScope = async (
  custodianId,
  { transaction = null } = {},
) => {
  const id = String(custodianId || "").trim();
  if (!id) return null;
  const custodian = await Custodian.findByPk(id, {
    attributes: ["id", "location"],
    transaction: transaction || undefined,
  });
  return normalizeLocationScope(custodian?.location || null);
};

module.exports = {
  LOCATION_SCOPE_FIELD,
  NO_LOCATION_ACCESS_SCOPE,
  assertActorCanAccessLocation,
  buildLocationScopeWhere,
  collectActorLocationScopes,
  getLocationScopeFromLocationText,
  getLocationScopeFromResolvedCustodian,
  mergeLocationScopeIntoWhere,
  normalizeLocationScope,
  resolveActorLocationScope,
  resolveCustodianLocationScope,
  resolveEmployeeLocationScope,
};
