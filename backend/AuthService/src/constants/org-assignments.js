"use strict";

const ASSIGNMENT_SCOPE_TYPES = Object.freeze({
  DIVISION: "DIVISION",
  VEHICLE: "VEHICLE",
  CUSTODIAN: "CUSTODIAN",
  LOCATION: "LOCATION",
  GLOBAL: "GLOBAL",
});

const ORG_ASSIGNMENT_CONFIG = Object.freeze({
  DIVISION_HEAD: Object.freeze({
    roleName: "DIVISION_HEAD",
    defaultScopeType: ASSIGNMENT_SCOPE_TYPES.CUSTODIAN,
    allowedScopeTypes: [
      ASSIGNMENT_SCOPE_TYPES.DIVISION,
      ASSIGNMENT_SCOPE_TYPES.CUSTODIAN,
    ],
    singleActivePerScope: true,
    singleActivePerUser: false,
  }),
  DIVISION_CUSTODIAN: Object.freeze({
    roleName: "DIVISION_CUSTODIAN",
    defaultScopeType: ASSIGNMENT_SCOPE_TYPES.CUSTODIAN,
    allowedScopeTypes: [
      ASSIGNMENT_SCOPE_TYPES.DIVISION,
      ASSIGNMENT_SCOPE_TYPES.CUSTODIAN,
    ],
    singleActivePerScope: true,
    singleActivePerUser: false,
  }),
  VEHICLE_DRIVER: Object.freeze({
    roleName: "VEHICLE_DRIVER",
    defaultScopeType: ASSIGNMENT_SCOPE_TYPES.CUSTODIAN,
    allowedScopeTypes: [
      ASSIGNMENT_SCOPE_TYPES.VEHICLE,
      ASSIGNMENT_SCOPE_TYPES.CUSTODIAN,
    ],
    singleActivePerScope: true,
    singleActivePerUser: false,
  }),
  LOCATION_INCHARGE: Object.freeze({
    roleName: "LOCATION_INCHARGE",
    defaultScopeType: ASSIGNMENT_SCOPE_TYPES.LOCATION,
    allowedScopeTypes: [ASSIGNMENT_SCOPE_TYPES.LOCATION],
    singleActivePerScope: true,
    singleActivePerUser: false,
  }),
  STORE_INCHARGE: Object.freeze({
    roleName: "STORE_INCHARGE",
    defaultScopeType: ASSIGNMENT_SCOPE_TYPES.LOCATION,
    allowedScopeTypes: [
      ASSIGNMENT_SCOPE_TYPES.LOCATION,
      ASSIGNMENT_SCOPE_TYPES.GLOBAL,
    ],
    singleActivePerScope: true,
    singleActivePerUser: false,
  }),
  GLOBAL: Object.freeze({
    roleName: null,
    defaultScopeType: ASSIGNMENT_SCOPE_TYPES.GLOBAL,
    allowedScopeTypes: [ASSIGNMENT_SCOPE_TYPES.GLOBAL],
    singleActivePerScope: true,
    singleActivePerUser: false,
  }),
});

const normalizeAssignmentType = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizeScopeType = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizeScopeKey = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const normalizeScopeLabel = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const getAssignmentConfig = (assignmentType) =>
  ORG_ASSIGNMENT_CONFIG[normalizeAssignmentType(assignmentType)] || null;

const getSupportedAssignmentTypes = () => Object.keys(ORG_ASSIGNMENT_CONFIG);

const isSupportedScopeType = (scopeType) =>
  Object.values(ASSIGNMENT_SCOPE_TYPES).includes(normalizeScopeType(scopeType));

const getManagedRoleNameForAssignment = (assignmentType) =>
  getAssignmentConfig(assignmentType)?.roleName || null;

const ASSIGNMENT_MANAGED_ROLE_NAMES = Object.freeze(
  Object.values(ORG_ASSIGNMENT_CONFIG)
    .map((config) => config.roleName)
    .filter(Boolean),
);

const isAssignmentManagedRole = (roleName) =>
  ASSIGNMENT_MANAGED_ROLE_NAMES.includes(
    String(roleName || "")
      .trim()
      .toUpperCase(),
  );

module.exports = {
  ASSIGNMENT_SCOPE_TYPES,
  ORG_ASSIGNMENT_CONFIG,
  ASSIGNMENT_MANAGED_ROLE_NAMES,
  getAssignmentConfig,
  getManagedRoleNameForAssignment,
  getSupportedAssignmentTypes,
  isAssignmentManagedRole,
  isSupportedScopeType,
  normalizeAssignmentType,
  normalizeScopeKey,
  normalizeScopeLabel,
  normalizeScopeType,
};
