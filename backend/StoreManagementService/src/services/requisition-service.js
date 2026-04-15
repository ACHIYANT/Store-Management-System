const axios = require("axios");
const RequisitionRepository = require("../repository/requisition-repository");
const { AUTH_BASE_URL } = require("../config/serverConfig");
const {
  resolvePendingQueueHoldersInAuthService,
} = require("../utils/auth-pending-holder-api");
const {
  assertActorCanAccessLocation,
  resolveActorLocationScope,
  resolveEmployeeLocationScope,
} = require("../utils/location-scope");
const { normalizeDivisionValue } = require("../utils/division-utils");

// Store fulfillment is picked up automatically once the last approval stage
// marks the requisition Approved/PartiallyApproved. It is not modeled as
// another approval-stage role here.
const DEFAULT_REQUISITION_STAGES = [
  { role_name: "DIVISION_HEAD", stage_order: 1, flow_type: "REQUISITION" },
  { role_name: "ADMIN_APPROVER", stage_order: 2, flow_type: "REQUISITION" },
];

const STORE_STAGE_STATUSES = new Set([
  "Approved",
  "PartiallyApproved",
  "Fulfilling",
]);

const normalizeDivisionScopeValue = (value) => normalizeDivisionValue(value) || "";
const normalizeLocationScopeValue = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const getAssignmentsByType = (assignments = [], assignmentType, scopeType = null) => {
  const normalizedType = String(assignmentType || "").trim().toUpperCase();
  const normalizedScopeType = scopeType
    ? String(scopeType).trim().toUpperCase()
    : null;

  if (!Array.isArray(assignments)) return [];

  return assignments.filter((assignment) => {
    const type = String(assignment?.assignment_type || "").trim().toUpperCase();
    const currentScopeType = String(assignment?.scope_type || "")
      .trim()
      .toUpperCase();
    if (!type || type !== normalizedType) return false;
    if (normalizedScopeType && currentScopeType !== normalizedScopeType) return false;
    return true;
  });
};

const getDivisionHeadAssignmentContexts = (assignments = []) => {
  const contexts = [];
  const seen = new Set();

  for (const assignment of getAssignmentsByType(assignments, "DIVISION_HEAD")) {
    const divisionValue = normalizeDivisionScopeValue(
      assignment?.metadata_json?.division_value ||
        assignment?.scope_label ||
        assignment?.metadata_json?.display_name,
    );
    if (!divisionValue) continue;

    const locationScope = normalizeLocationScopeValue(
      assignment?.metadata_json?.location ||
        (String(assignment?.scope_type || "").trim().toUpperCase() === "LOCATION"
          ? assignment?.scope_key || assignment?.scope_label
          : ""),
    );
    const dedupeKey = `${divisionValue}::${locationScope || ""}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    contexts.push({
      division_value: divisionValue,
      location_scope: locationScope || null,
    });
  }

  return contexts;
};

const hasDivisionHeadAssignments = (assignments = []) =>
  getDivisionHeadAssignmentContexts(assignments).length > 0;

const hasMatchingDivisionHeadAssignmentContext = (
  assignments = [],
  expectedDivision,
  expectedLocation = null,
) => {
  const normalizedDivision = normalizeDivisionScopeValue(expectedDivision);
  const normalizedLocation = normalizeLocationScopeValue(expectedLocation);
  if (!normalizedDivision) return false;

  const contexts = getDivisionHeadAssignmentContexts(assignments).filter(
    (context) => context.division_value === normalizedDivision,
  );
  if (!contexts.length) return false;
  if (!normalizedLocation) return true;

  const hasExactLocationMatch = contexts.some(
    (context) => context.location_scope === normalizedLocation,
  );
  if (hasExactLocationMatch) return true;

  return contexts.some((context) => !context.location_scope);
};

class RequisitionService {
  constructor() {
    this.repository = new RequisitionRepository();
    this.stageCache = {
      at: 0,
      stages: [],
    };
  }

  _normalizeRoleName(role) {
    const normalized = String(role || "").trim().toUpperCase();
    if (!normalized) return "";
    if (normalized === "DIVISIONAL_HEAD") return "DIVISION_HEAD";
    return normalized;
  }

  _normalizeRoles(roles) {
    return Array.isArray(roles)
      ? roles
          .map((role) => this._normalizeRoleName(role))
          .filter(Boolean)
      : [];
  }

  _normalizeStageList(stages = []) {
    return (stages || [])
      .map((stage) => ({
        role_name: this._normalizeRoleName(stage?.role_name),
        stage_order: Number(stage?.stage_order),
        flow_type: stage?.flow_type
          ? String(stage.flow_type).trim().toUpperCase()
          : null,
      }))
      .filter(
        (stage) => stage.role_name && Number.isFinite(stage.stage_order),
      )
      .sort((a, b) => a.stage_order - b.stage_order);
  }

  _resolveRequesterDivision(actor = {}) {
    return normalizeDivisionValue(actor?.division || null) || actor?.division || null;
  }

  async _resolveRequesterLocationScope(actor = {}, payload = {}) {
    const requestedLocationScope = payload?.location_scope || payload?.location || null;
    if (requestedLocationScope) {
      return resolveActorLocationScope(actor || {}, requestedLocationScope);
    }

    const source = String(actor?.location_scope_source || "").trim().toLowerCase();
    const hasActorLocationScopes =
      Array.isArray(actor?.location_scopes) &&
      actor.location_scopes.some((scope) => String(scope || "").trim());

    if ((source && source !== "employee") || (!source && hasActorLocationScopes)) {
      return resolveActorLocationScope(actor || {}, null);
    }

    const employeeLocationScope =
      (await resolveEmployeeLocationScope(actor?.empcode || null)) || null;
    if (employeeLocationScope) {
      return employeeLocationScope;
    }

    return resolveActorLocationScope(actor || {}, null);
  }

  async _fetchApprovalStagesFromAuth() {
    const response = await axios.get(`${AUTH_BASE_URL}/approval/stages`, {
      params: { flow_type: "REQUISITION" },
    });
    return Array.isArray(response?.data?.data) ? response.data.data : [];
  }

  async getStagesForRequisition() {
    const now = Date.now();
    const cacheTtlMs = 60 * 1000;

    if (!this.stageCache.at || now - this.stageCache.at > cacheTtlMs) {
      try {
        const rawStages = await this._fetchApprovalStagesFromAuth();
        const normalized = this._normalizeStageList(rawStages);
        this.stageCache = {
          at: now,
          stages: normalized,
        };
      } catch {
        // Keep last known good stages on transient auth-service failures.
        this.stageCache = {
          at: now,
          stages: Array.isArray(this.stageCache.stages)
            ? this.stageCache.stages
            : [],
        };
      }
    }

    // Keep requisition approval flow fully separate from daybook:
    // only consume stages explicitly marked for REQUISITION flow.
    const requisitionStages = this.stageCache.stages.filter((stage) =>
      ["REQUISITION", "ALL"].includes(stage.flow_type),
    );

    if (requisitionStages.length > 0) {
      return requisitionStages;
    }

    // Safe default when REQUISITION stages are not configured in AuthService yet.
    return [...DEFAULT_REQUISITION_STAGES];
  }

  async _resolveUserStageOrders(userRoles = []) {
    const roles = this._normalizeRoles(userRoles);
    if (!roles.length) return [];

    const stages = await this.getStagesForRequisition();
    return [...new Set(
      stages
        .filter((stage) => roles.includes(stage.role_name))
        .map((stage) => Number(stage.stage_order))
        .filter((n) => Number.isFinite(n)),
    )];
  }

  async create(payload = {}, actor = {}) {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const stages = await this.getStagesForRequisition();
    const initialStage = stages[0] || null;
    const requesterLocationScope = await this._resolveRequesterLocationScope(
      actor,
      payload,
    );

    return this.repository.create({
      requesterUserId: Number(actor?.id),
      requesterEmpId:
        actor?.empcode !== undefined && actor?.empcode !== null
          ? String(actor.empcode)
          : null,
      requesterName: actor?.fullname || actor?.name || null,
      requesterDivision: this._resolveRequesterDivision(actor),
      requesterLocationScope,
      purpose: payload?.purpose || null,
      remarks: payload?.remarks || null,
      items,
      initialStage,
      autoSubmit:
        payload?.autoSubmit === undefined ? true : Boolean(payload.autoSubmit),
    });
  }

  async list(query = {}, actor = {}) {
    const stages = await this.getStagesForRequisition();
    const firstStageOrder = stages.length ? Number(stages[0].stage_order) : null;
    const viewerStageOrders = await this._resolveUserStageOrders(actor?.roles || []);
    const result = await this.repository.list({
      scope: query.scope || "my",
      page: query.page,
      limit: query.limit,
      cursor: query.cursor,
      cursorMode: query.cursorMode,
      status: query.status,
      search: query.search,
      fromDate: query.fromDate,
      toDate: query.toDate,
      viewerUserId: actor?.id || null,
      viewerDivision: this._resolveRequesterDivision(actor),
      viewerRoles: actor?.roles || [],
      viewerAssignments: actor?.assignments || [],
      viewerActor: actor || {},
      viewerStageOrders,
      firstStageOrder,
    });

    const requestedScope = String(query?.scope || "my").trim().toLowerCase();
    const shouldResolvePendingHolder =
      requestedScope === "queue" || requestedScope === "store" || requestedScope === "inbox";
    if (!shouldResolvePendingHolder) {
      return result;
    }

    const baseRows = Array.isArray(result?.rows) ? result.rows : [];
    if (!baseRows.length) {
      return result;
    }

    const holderTargets = baseRows.map((row) => ({
      requisition_id: row.id,
      status: row.status,
      current_stage_role:
        row.current_stage_role ||
        (STORE_STAGE_STATUSES.has(String(row?.status || "").trim()) ? "STORE_ENTRY" : null),
      requester_division: row.requester_division,
      location_scope: row.location_scope,
    }));

    try {
      const resolved = await resolvePendingQueueHoldersInAuthService(holderTargets);
      const byRequisitionId = new Map(
        (Array.isArray(resolved?.targets) ? resolved.targets : [])
          .map((target) => [Number(target?.requisition_id), target])
          .filter(([requisitionId]) => Number.isFinite(requisitionId)),
      );

      return {
        ...result,
        rows: baseRows.map((row) => {
          const pendingHolder = byRequisitionId.get(Number(row?.id)) || null;
          return {
            ...row,
            pending_holder: pendingHolder?.primary_holder || null,
            pending_holder_count: Number(pendingHolder?.holder_count || 0),
            pending_holder_source: pendingHolder?.source || null,
          };
        }),
      };
    } catch (error) {
      console.error("RequisitionService.list pending-holder enrichment failed:", error);
      return result;
    }
  }

  async getById(id, actor = {}) {
    const record = await this.repository.getById(id);
    if (!record) return null;
    assertActorCanAccessLocation(
      actor || {},
      record.location_scope,
      "access this requisition",
    );

    const actorUserId = Number(actor?.id);
    const actorRoles = this._normalizeRoles(actor?.roles || []);
    const stages = await this.getStagesForRequisition();
    const firstStageOrder = stages.length ? Number(stages[0].stage_order) : null;

    const isPrivileged =
      actorRoles.includes("SUPER_ADMIN") || actorRoles.includes("STORE_ENTRY");
    const isCreator = Number(record.requester_user_id) === actorUserId;
    const isActorInTimeline = Array.isArray(record.actions)
      ? record.actions.some((action) => Number(action.acted_by_user_id) === actorUserId)
      : false;
    const currentStageRole = this._normalizeRoleName(record.current_stage_role);
    const isCurrentApproverRole =
      currentStageRole && actorRoles.includes(currentStageRole);

    let canSeeAsCurrentApprover = isCurrentApproverRole;
    if (
      canSeeAsCurrentApprover &&
      Number.isFinite(firstStageOrder) &&
      Number(record.current_stage_order) === firstStageOrder &&
      String(record.requester_division || "").trim()
    ) {
      const requesterDivision =
        normalizeDivisionValue(record.requester_division) || record.requester_division;
      const actorDivision = normalizeDivisionValue(actor?.division || null);
      const actorHasDivisionHeadAssignmentScope = hasDivisionHeadAssignments(
        actor?.assignments || [],
      );
      canSeeAsCurrentApprover =
        (actorHasDivisionHeadAssignmentScope
          ? hasMatchingDivisionHeadAssignmentContext(
              actor?.assignments || [],
              requesterDivision,
              record.location_scope,
            )
          : false) ||
        (!actorHasDivisionHeadAssignmentScope &&
          actorDivision &&
          actorDivision === requesterDivision);
    }

    if (
      !isPrivileged &&
      !isCreator &&
      !isActorInTimeline &&
      !canSeeAsCurrentApprover
    ) {
      const error = new Error("Forbidden: you cannot access this requisition.");
      error.statusCode = 403;
      throw error;
    }

    return record;
  }

  async approve(id, payload = {}, actor = {}) {
    const stages = await this.getStagesForRequisition();
    const firstStageOrder = stages.length ? Number(stages[0].stage_order) : null;
    return this.repository.approve({
      requisitionId: Number(id),
      actor,
      stages,
      remarks: payload?.remarks || null,
      decisions: Array.isArray(payload?.decisions) ? payload.decisions : [],
      firstStageOrder,
    });
  }

  async reject(id, payload = {}, actor = {}) {
    const stages = await this.getStagesForRequisition();
    const firstStageOrder = stages.length ? Number(stages[0].stage_order) : null;
    return this.repository.reject({
      requisitionId: Number(id),
      actor,
      remarks: payload?.remarks || null,
      firstStageOrder,
    });
  }

  async submit(id, payload = {}, actor = {}) {
    const stages = await this.getStagesForRequisition();
    const initialStage = stages[0] || null;
    return this.repository.submitDraft({
      requisitionId: Number(id),
      actor,
      initialStage,
      remarks: payload?.remarks || null,
      requesterDivision: this._resolveRequesterDivision(actor),
      requesterLocationScope: await this._resolveRequesterLocationScope(actor, payload),
    });
  }

  async cancel(id, payload = {}, actor = {}) {
    return this.repository.cancel({
      requisitionId: Number(id),
      actor,
      remarks: payload?.remarks || null,
    });
  }

  async mapItems(id, payload = {}, actor = {}) {
    return this.repository.mapItems({
      requisitionId: Number(id),
      mappings: Array.isArray(payload?.mappings) ? payload.mappings : [],
      actor,
      requireComplete:
        payload?.requireComplete === undefined
          ? true
          : Boolean(payload.requireComplete),
    });
  }

  async addAttachment(id, payload = {}, actor = {}) {
    return this.repository.addAttachment({
      requisitionId: Number(id),
      actionId: payload?.actionId || null,
      attachmentType: payload?.attachmentType || "Supporting",
      fileUrl: payload?.fileUrl,
      fileName: payload?.fileName || null,
      mimeType: payload?.mimeType || null,
      actor,
    });
  }

  async listForIssue(query = {}, actor = {}) {
    return this.repository.listForIssue({
      employeeId: query.employeeId || null,
      search: query.search || "",
      cursor: query.cursor || null,
      cursorMode: Boolean(query.cursorMode),
      limit: query.limit,
      viewerActor: actor || {},
    });
  }

  async getUserDashboardSummary(query = {}, actor = {}) {
    return this.repository.getUserDashboardSummary({
      viewerUserId: actor?.id || null,
      queueLimit: query.queueLimit,
      historyLimit: query.historyLimit,
      recentLimit: query.recentLimit,
      actionNeededLimit: query.actionNeededLimit,
      months: query.months,
    });
  }
}

module.exports = RequisitionService;
