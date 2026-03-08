const axios = require("axios");
const RequisitionRepository = require("../repository/requisition-repository");
const { AUTH_BASE_URL } = require("../config/serverConfig");

const DEFAULT_REQUISITION_STAGES = [
  { role_name: "DIVISION_HEAD", stage_order: 1, flow_type: "REQUISITION" },
  { role_name: "ADMIN_APPROVER", stage_order: 2, flow_type: "REQUISITION" },
];

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

    return this.repository.create({
      requesterUserId: Number(actor?.id),
      requesterEmpId:
        actor?.empcode !== undefined && actor?.empcode !== null
          ? String(actor.empcode)
          : null,
      requesterName: actor?.fullname || actor?.name || null,
      requesterDivision: actor?.division || null,
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

    return this.repository.list({
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
      viewerDivision: actor?.division || null,
      viewerRoles: actor?.roles || [],
      viewerStageOrders,
      firstStageOrder,
    });
  }

  async getById(id, actor = {}) {
    const record = await this.repository.getById(id);
    if (!record) return null;

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
      canSeeAsCurrentApprover =
        String(actor?.division || "").trim() &&
        String(actor.division).trim().toLowerCase() ===
          String(record.requester_division).trim().toLowerCase();
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

  async listForIssue(query = {}) {
    return this.repository.listForIssue({
      employeeId: query.employeeId || null,
      search: query.search || "",
      cursor: query.cursor || null,
      cursorMode: Boolean(query.cursorMode),
      limit: query.limit,
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
