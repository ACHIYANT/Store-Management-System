const { StatusCodes } = require("http-status-codes");
const { sequelize } = require("../models");
const OrgAssignmentRepository = require("../repository/org-assignment-repository");
const UserRepository = require("../repository/user-repository");
const {
  ASSIGNMENT_SCOPE_TYPES,
  getAssignmentConfig,
  getSupportedAssignmentTypes,
  isSupportedScopeType,
  normalizeAssignmentType,
  normalizeScopeKey,
  normalizeScopeLabel,
  normalizeScopeType,
} = require("../constants/org-assignments");
const {
  formatDivisionDisplayLabel,
  isKnownDivisionValue,
  normalizeDivisionValue,
} = require("../utils/division-utils");
const {
  LOCATION_OPTIONS,
  normalizeLocationValue,
} = require("../utils/location-options");

const createError = (message, statusCode = StatusCodes.BAD_REQUEST) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toOptionalObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;

const toValidDate = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createError(`${fieldName} is invalid.`);
  }
  return parsed;
};

const ALLOWED_LOCATION_LIST = LOCATION_OPTIONS.map((option) => option.value).join(
  ", ",
);

const serializeAssignment = (assignment) => {
  const plain = assignment?.get ? assignment.get({ plain: true }) : assignment;
  return {
    id: plain?.id,
    user_id: plain?.user_id,
    assignment_type: plain?.assignment_type,
    scope_type: plain?.scope_type,
    scope_key: plain?.scope_key,
    scope_label: plain?.scope_label,
    metadata_json: plain?.metadata_json || null,
    notes: plain?.notes || null,
    active: Boolean(plain?.active),
    effective_from: plain?.effective_from || null,
    effective_to: plain?.effective_to || null,
    created_by_user_id: plain?.created_by_user_id || null,
    ended_by_user_id: plain?.ended_by_user_id || null,
    user: plain?.user
      ? {
          id: plain.user.id,
          empcode: plain.user.empcode,
          fullname: plain.user.fullname,
          mobileno: plain.user.mobileno,
          designation: plain.user.designation,
          division: plain.user.division,
        }
      : null,
  };
};

class OrgAssignmentService {
  constructor() {
    this.assignmentRepository = new OrgAssignmentRepository();
    this.userRepository = new UserRepository();
  }

  _normalizePayload(payload = {}) {
    const userId = Number(payload.userId ?? payload.user_id);
    const assignmentType = normalizeAssignmentType(
      payload.assignmentType ?? payload.assignment_type,
    );
    const config = getAssignmentConfig(assignmentType);
    if (!config) {
      throw createError(
        `Unsupported assignment_type. Allowed values: ${getSupportedAssignmentTypes().join(", ")}.`,
      );
    }

    const scopeType = normalizeScopeType(
      payload.scopeType ?? payload.scope_type ?? config.defaultScopeType,
    );
    if (!scopeType) throw createError("scope_type is required.");
    if (!isSupportedScopeType(scopeType)) {
      throw createError(
        "Unsupported scope_type. Allowed values: DIVISION, VEHICLE, CUSTODIAN, LOCATION, GLOBAL.",
      );
    }
    if (
      Array.isArray(config.allowedScopeTypes) &&
      config.allowedScopeTypes.length &&
      !config.allowedScopeTypes.includes(scopeType)
    ) {
      throw createError(
        `assignment_type ${assignmentType} does not allow scope_type ${scopeType}.`,
      );
    }

    const providedMetadata =
      toOptionalObject(payload.metadataJson ?? payload.metadata_json ?? payload.metadata) ||
      null;
    let scopeKey = normalizeScopeKey(
      payload.scopeKey ??
        payload.scope_key ??
        payload.scopeValue ??
        payload.scope_value ??
        providedMetadata?.custodian_id ??
        providedMetadata?.scope_key,
    );
    let scopeLabel = normalizeScopeLabel(
      payload.scopeLabel ??
        payload.scope_label ??
        payload.scopeKey ??
        payload.scope_key ??
        providedMetadata?.display_name ??
        providedMetadata?.scope_label,
    );
    if (!Number.isFinite(userId) || userId <= 0) {
      throw createError("userId is required.");
    }

    let metadataJson = providedMetadata;

    if (scopeType === ASSIGNMENT_SCOPE_TYPES.CUSTODIAN) {
      const providedDisplayName = normalizeScopeLabel(
        metadataJson?.display_name ||
          metadataJson?.scope_label ||
          payload.displayName ||
          payload.display_name,
      );
      const custodianType = String(
        metadataJson?.custodian_type || metadataJson?.type || "",
      )
        .trim()
        .toUpperCase();
      const expectedCustodianType =
        assignmentType === "DIVISION_HEAD" ||
        assignmentType === "DIVISION_CUSTODIAN"
          ? "DIVISION"
          : assignmentType === "VEHICLE_DRIVER"
            ? "VEHICLE"
            : null;

      if (!custodianType) {
        throw createError(
          "custodian_type is required in metadata_json for CUSTODIAN assignments.",
        );
      }
      if (expectedCustodianType && custodianType !== expectedCustodianType) {
        throw createError(
          `${assignmentType} requires custodian_type ${expectedCustodianType}.`,
        );
      }

      metadataJson = {
        ...(metadataJson || {}),
        custodian_id: scopeKey,
        custodian_type: custodianType,
        display_name: providedDisplayName || scopeLabel || metadataJson?.display_name || null,
        location: (() => {
          const rawLocation =
            metadataJson?.location !== undefined && metadataJson?.location !== null
              ? metadataJson.location
              : payload.location;
          if (rawLocation === undefined || rawLocation === null) return null;
          const normalizedLocation = normalizeLocationValue(rawLocation);
          if (!normalizedLocation) {
            throw createError(
              `location must be one of: ${ALLOWED_LOCATION_LIST}.`,
            );
          }
          return normalizedLocation;
        })(),
      };

      if (custodianType === "DIVISION") {
        const divisionValue =
          normalizeDivisionValue(
            metadataJson?.division_value ||
              payload.divisionValue ||
              payload.division_value ||
              scopeLabel ||
              providedDisplayName,
          ) || null;
        if (!divisionValue || !isKnownDivisionValue(divisionValue)) {
          throw createError(
            "division_value must be one of the configured divisions.",
          );
        }
        if (!metadataJson.location) {
          throw createError(
            `location is required and must be one of: ${ALLOWED_LOCATION_LIST} for DIVISION assignments.`,
          );
        }
        scopeLabel = divisionValue || scopeLabel || providedDisplayName || null;
        metadataJson = {
          ...metadataJson,
          division_value: divisionValue,
          division_display_label: divisionValue
            ? formatDivisionDisplayLabel(divisionValue)
            : null,
          display_name:
            metadataJson.display_name || providedDisplayName || scopeLabel || null,
        };
      }
    }

    if (scopeType === ASSIGNMENT_SCOPE_TYPES.LOCATION) {
      const resolvedLocation = normalizeLocationValue(
        scopeLabel ||
          metadataJson?.location ||
          payload.location ||
          payload.scopeLabel ||
          payload.scopeKey,
      );
      if (!resolvedLocation) {
        throw createError(`location must be one of: ${ALLOWED_LOCATION_LIST}.`);
      }
      scopeLabel = resolvedLocation || scopeLabel || null;
      scopeKey = scopeKey || normalizeScopeKey(resolvedLocation);
      metadataJson = {
        ...(metadataJson || {}),
        location: resolvedLocation,
      };
    }

    if (scopeType === ASSIGNMENT_SCOPE_TYPES.GLOBAL) {
      const resolvedLabel =
        normalizeScopeLabel(
          scopeLabel ||
            metadataJson?.display_name ||
            metadataJson?.scope_label ||
            payload.scopeLabel ||
            payload.scopeKey ||
            "Entire Organization",
        ) || "Entire Organization";
      scopeLabel = resolvedLabel;
      scopeKey =
        scopeKey ||
        normalizeScopeKey(
          payload.scopeKey ??
            payload.scope_key ??
            metadataJson?.scope_key ??
            assignmentType ??
            "GLOBAL",
        ) ||
        "GLOBAL";
      metadataJson = {
        ...(metadataJson || {}),
        display_name: resolvedLabel,
      };
    }

    if (!scopeKey) throw createError("scopeKey is required.");

    return {
      userId,
      assignmentType,
      scopeType,
      scopeKey,
      scopeLabel: scopeLabel || null,
      metadataJson,
      notes:
        payload.notes !== undefined && payload.notes !== null
          ? String(payload.notes).trim() || null
          : null,
      effectiveFrom:
        payload.effectiveFrom || payload.effective_from
          ? toValidDate(
              payload.effectiveFrom || payload.effective_from,
              "effectiveFrom",
            )
          : new Date(),
      config,
    };
  }

  async list(query = {}) {
    const assignmentType = query.assignmentType
      ? normalizeAssignmentType(query.assignmentType)
      : query.assignment_type
        ? normalizeAssignmentType(query.assignment_type)
        : null;
    const scopeType = query.scopeType
      ? normalizeScopeType(query.scopeType)
      : query.scope_type
        ? normalizeScopeType(query.scope_type)
        : null;
    const scopeKey = query.scopeKey
      ? normalizeScopeKey(query.scopeKey)
      : query.scope_key
        ? normalizeScopeKey(query.scope_key)
        : null;
    const active =
      query.active === undefined
        ? null
        : String(query.active).trim().toLowerCase() === "true";

    const rows = await this.assignmentRepository.list({
      userId: query.userId || query.user_id || null,
      assignmentType,
      scopeType,
      scopeKey,
      active,
    });

    return rows.map((row) => serializeAssignment(row));
  }

  async assign(payload = {}, actor = {}) {
    const normalized = this._normalizePayload(payload);
    const actorUserId = Number(actor?.id) > 0 ? Number(actor.id) : null;

    return sequelize.transaction(async (transaction) => {
      const targetUser = await this.userRepository.getUserByIdForUpdate(
        normalized.userId,
        transaction,
      );
      if (!targetUser) {
        throw createError("User not found.", StatusCodes.NOT_FOUND);
      }

      const sameScopeAssignments =
        await this.assignmentRepository.findActiveByScope(
          normalized.assignmentType,
          normalized.scopeType,
          normalized.scopeKey,
          transaction,
        );

      const sameUserAssignments = normalized.config.singleActivePerUser
        ? await this.assignmentRepository.findActiveForUserByType(
            normalized.userId,
            normalized.assignmentType,
            transaction,
          )
        : [];

      const sameScopeForSameUser = sameScopeAssignments.find(
        (row) => Number(row.user_id) === normalized.userId,
      );
      const canReuseExistingAssignment =
        sameScopeForSameUser &&
        sameScopeAssignments.every(
          (row) => Number(row.user_id) === normalized.userId,
        ) &&
        (!normalized.config.singleActivePerUser ||
          sameUserAssignments.every(
            (row) => Number(row.id) === Number(sameScopeForSameUser.id),
          ));

      if (canReuseExistingAssignment) {
        await sameScopeForSameUser.update(
          {
            scope_label: normalized.scopeLabel,
            metadata_json: normalized.metadataJson,
            notes: normalized.notes,
            effective_from: normalized.effectiveFrom,
            active: true,
            effective_to: null,
            ended_by_user_id: null,
          },
          { transaction },
        );
        await this.userRepository.syncManagedRoleForUser(
          normalized.userId,
          normalized.assignmentType,
          transaction,
        );
        const refreshed = await this.assignmentRepository.findByIdForUpdate(
          sameScopeForSameUser.id,
          transaction,
        );
        return serializeAssignment(refreshed);
      }

      const assignmentIdsToEnd = new Set();
      const affectedUserIds = new Set();

      for (const row of sameScopeAssignments) {
        assignmentIdsToEnd.add(Number(row.id));
        affectedUserIds.add(Number(row.user_id));
      }

      if (normalized.config.singleActivePerUser) {
        for (const row of sameUserAssignments) {
          assignmentIdsToEnd.add(Number(row.id));
          affectedUserIds.add(Number(row.user_id));
        }
      }

      if (assignmentIdsToEnd.size) {
        await this.assignmentRepository.endAssignments(
          [...assignmentIdsToEnd],
          {
            effective_to: new Date(),
            ended_by_user_id: actorUserId,
          },
          transaction,
        );
      }

      const created = await this.assignmentRepository.create(
        {
          user_id: normalized.userId,
          assignment_type: normalized.assignmentType,
          scope_type: normalized.scopeType,
          scope_key: normalized.scopeKey,
          scope_label: normalized.scopeLabel,
          metadata_json: normalized.metadataJson,
          notes: normalized.notes,
          active: true,
          effective_from: normalized.effectiveFrom,
          effective_to: null,
          created_by_user_id: actorUserId,
          ended_by_user_id: null,
        },
        transaction,
      );

      affectedUserIds.add(normalized.userId);
      for (const userId of affectedUserIds) {
        if (Number.isFinite(Number(userId)) && Number(userId) > 0) {
          await this.userRepository.syncManagedRoleForUser(
            Number(userId),
            normalized.assignmentType,
            transaction,
          );
        }
      }

      const refreshed = await this.assignmentRepository.findByIdForUpdate(
        created.id,
        transaction,
      );
      return serializeAssignment(refreshed);
    });
  }

  async end(assignmentId, payload = {}, actor = {}) {
    const id = Number(assignmentId);
    if (!Number.isFinite(id) || id <= 0) {
      throw createError("assignmentId is invalid.");
    }
    const actorUserId = Number(actor?.id) > 0 ? Number(actor.id) : null;

    return sequelize.transaction(async (transaction) => {
      const assignment = await this.assignmentRepository.findByIdForUpdate(
        id,
        transaction,
      );
      if (!assignment) {
        throw createError("Assignment not found.", StatusCodes.NOT_FOUND);
      }
      if (!assignment.active) {
        return serializeAssignment(assignment);
      }

      await assignment.update(
        {
          active: false,
          effective_to:
            payload.effectiveTo || payload.effective_to
              ? toValidDate(
                  payload.effectiveTo || payload.effective_to,
                  "effectiveTo",
                )
              : new Date(),
          ended_by_user_id: actorUserId,
          notes:
            payload.notes !== undefined
              ? String(payload.notes || "").trim() || assignment.notes || null
              : assignment.notes,
        },
        { transaction },
      );

      await this.userRepository.syncManagedRoleForUser(
        Number(assignment.user_id),
        assignment.assignment_type,
        transaction,
      );

      return serializeAssignment(assignment);
    });
  }
}

module.exports = new OrgAssignmentService();
