const {
  sequelize,
  Requisition,
  RequisitionItem,
  RequisitionAction,
  RequisitionAttachment,
  Stock,
  ItemCategory,
} = require("../models");
const { Op, QueryTypes } = require("sequelize");
const {
  decodeCursor,
  encodeCursor,
  normalizeLimit,
  applyDateIdDescCursor,
} = require("../utils/cursor-pagination");
const { normalizeSkuUnit, sameSkuUnit } = require("../utils/sku-units");
const { ensureItemMaster } = require("../services/item-master-service");
const {
  assertActorCanAccessLocation,
  buildLocationScopeWhere,
} = require("../utils/location-scope");

const FINAL_REQUISITION_STATUSES = new Set([
  "Approved",
  "PartiallyApproved",
  "Rejected",
  "Cancelled",
  "Fulfilled",
]);

const ACTIVE_REVIEW_STATUSES = ["Submitted", "InReview", "PartiallyApproved"];

const USER_DASHBOARD_WORKFLOW_STATUSES = [
  "Draft",
  "Submitted",
  "InReview",
  "PartiallyApproved",
  "Approved",
  "Fulfilling",
];

const USER_DASHBOARD_FINAL_STATUSES = ["Rejected", "Cancelled", "Fulfilled"];

const USER_DASHBOARD_APPROVED_LIKE_STATUSES = [
  "Approved",
  "PartiallyApproved",
  "Fulfilling",
  "Fulfilled",
];

const USER_DASHBOARD_ACTION_NEEDED_STATUSES = ["Draft", "Rejected"];

const TERMINAL_ITEM_STATUSES = new Set(["Rejected", "Cancelled", "Fulfilled"]);

function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toPositiveId(value) {
  const n = toNumber(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Number(n.toFixed(3)));
}

function toWholeQty(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  if (!Number.isInteger(n)) return null;
  return n;
}

function eqText(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function normalizeAssignments(assignments = []) {
  return Array.isArray(assignments)
    ? assignments
        .map((assignment) => ({
          assignment_type: String(assignment?.assignment_type || "")
            .trim()
            .toUpperCase(),
          scope_type: String(assignment?.scope_type || "")
            .trim()
            .toUpperCase(),
          scope_key: String(assignment?.scope_key || "").trim(),
          scope_label: String(assignment?.scope_label || "").trim(),
          metadata_json:
            assignment?.metadata_json && typeof assignment.metadata_json === "object"
              ? assignment.metadata_json
              : null,
        }))
        .filter((assignment) => assignment.assignment_type && assignment.scope_type)
    : [];
}

function getAssignmentScopeValues(
  assignments = [],
  assignmentType,
  scopeType = null,
) {
  const normalizedType = String(assignmentType || "")
    .trim()
    .toUpperCase();
  const normalizedScopeType = scopeType
    ? String(scopeType).trim().toUpperCase()
    : null;
  const values = [];

  for (const assignment of normalizeAssignments(assignments)) {
    if (assignment.assignment_type !== normalizedType) continue;
    if (normalizedScopeType && assignment.scope_type !== normalizedScopeType) continue;
    if (assignment.scope_label) values.push(assignment.scope_label);
    if (assignment.scope_key) values.push(assignment.scope_key);
    if (assignment.metadata_json?.display_name) {
      values.push(String(assignment.metadata_json.display_name));
    }
  }

  return [...new Set(values.filter(Boolean))];
}

function hasMatchingAssignmentScope(
  assignments = [],
  assignmentType,
  expectedScopeValue,
  scopeType = null,
) {
  const expected = String(expectedScopeValue || "").trim();
  if (!expected) return false;

  return getAssignmentScopeValues(assignments, assignmentType, scopeType).some(
    (value) => eqText(value, expected),
  );
}

function deriveStageRoleDisplay(status, currentStageRole) {
  const rawRole = String(currentStageRole || "").trim();
  if (rawRole) return rawRole;

  const normalizedStatus = String(status || "").trim();
  if (["Approved", "PartiallyApproved", "Fulfilling", "Fulfilled"].includes(normalizedStatus)) {
    return "STORE_ENTRY";
  }

  return null;
}

function normalizeScope(scope) {
  const normalized = String(scope || "my").trim().toLowerCase();
  if (["my", "inbox", "store", "all"].includes(normalized)) return normalized;
  return "my";
}

function clampLimit(value, fallback = 10, max = 50) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

class RequisitionRepository {
  _sanitizeEmployeeCode(requesterEmpId, requesterUserId) {
    const rawCode =
      requesterEmpId !== null && requesterEmpId !== undefined && String(requesterEmpId).trim()
        ? String(requesterEmpId)
        : `U${requesterUserId}`;

    const normalized = rawCode
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);

    return normalized || `U${requesterUserId}`;
  }

  _buildReqNo({
    requesterEmpId = null,
    requesterUserId = null,
    requesterSerialNo = 1,
  }) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    const employeeCode = this._sanitizeEmployeeCode(requesterEmpId, requesterUserId);
    const serialPart = String(Math.max(1, toNumber(requesterSerialNo) || 1)).padStart(
      4,
      "0",
    );
    return `REQ-${employeeCode}-${yyyy}${mm}${dd}-${hh}${mi}${ss}${ms}-${serialPart}`;
  }

  _normalizeRoleName(role) {
    const normalized = String(role || "").toUpperCase();
    if (!normalized) return "";
    if (normalized === "DIVISIONAL_HEAD") return "DIVISION_HEAD";
    return normalized;
  }

  _normalizeRoles(roles = []) {
    return Array.isArray(roles)
      ? roles.map((role) => this._normalizeRoleName(role)).filter(Boolean)
      : [];
  }

  _mapSummary(row) {
    const p = row?.get ? row.get({ plain: true }) : row;
    const items = Array.isArray(p.items) ? p.items : [];
    const currentStageRoleDisplay = deriveStageRoleDisplay(
      p.status,
      p.current_stage_role,
    );

    let totalRequestedQty = 0;
    let totalApprovedQty = 0;
    let totalIssuedQty = 0;
    let pendingItems = 0;
    let rejectedItems = 0;
    let fulfilledItems = 0;
    let openItems = 0;

    for (const item of items) {
      const requested = toQty(item.requested_qty);
      const approved = toQty(item.approved_qty);
      const issued = toQty(item.issued_qty);
      const status = String(item.item_status || "");

      totalRequestedQty += requested;
      totalApprovedQty += approved;
      totalIssuedQty += issued;

      if (status === "Pending") pendingItems += 1;
      if (status === "Rejected") rejectedItems += 1;
      if (status === "Fulfilled") fulfilledItems += 1;
      if (!TERMINAL_ITEM_STATUSES.has(status)) openItems += 1;
    }

    return {
      id: p.id,
      req_no: p.req_no,
      requester_serial_no: p.requester_serial_no,
      requester_user_id: p.requester_user_id,
      requester_emp_id: p.requester_emp_id,
      requester_name: p.requester_name,
      requester_division: p.requester_division,
      location_scope: p.location_scope || null,
      purpose: p.purpose,
      status: p.status,
      current_stage_order: p.current_stage_order,
      current_stage_role: p.current_stage_role,
      current_stage_role_display: currentStageRoleDisplay,
      submitted_at: p.submitted_at,
      final_approved_at: p.final_approved_at,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      totals: {
        item_count: items.length,
        pending_items: pendingItems,
        rejected_items: rejectedItems,
        fulfilled_items: fulfilledItems,
        open_items: openItems,
        requested_qty: Number(totalRequestedQty.toFixed(3)),
        approved_qty: Number(totalApprovedQty.toFixed(3)),
        issued_qty: Number(totalIssuedQty.toFixed(3)),
        remaining_qty: Number(Math.max(0, totalApprovedQty - totalIssuedQty).toFixed(3)),
      },
    };
  }

  _mapDetail(row) {
    const p = row?.get ? row.get({ plain: true }) : row;
    const currentStageRoleDisplay = deriveStageRoleDisplay(
      p.status,
      p.current_stage_role,
    );

    const items = (p.items || [])
      .map((item) => ({
        id: item.id,
        item_no: item.item_no,
        item_category_id: item.item_category_id,
        item_master_id: item.item_master_id || null,
        stock_id: item.stock_id,
        particulars: item.particulars,
        sku_unit: item.sku_unit || "Unit",
        requested_qty: toQty(item.requested_qty),
        approved_qty: toQty(item.approved_qty),
        issued_qty: toQty(item.issued_qty),
        remaining_qty: Number(
          Math.max(0, toQty(item.approved_qty) - toQty(item.issued_qty)).toFixed(3),
        ),
        item_status: item.item_status,
        remarks: item.remarks,
        item_category_name: item.itemCategory?.category_name || null,
        stock_item_name: item.stock?.item_name || null,
        stock_quantity: toNumber(item.stock?.quantity),
      }))
      .sort((a, b) => a.item_no - b.item_no || a.id - b.id);

    const actions = (p.actions || [])
      .map((action) => ({
        id: action.id,
        requisition_item_id: action.requisition_item_id,
        stage_order: action.stage_order,
        stage_role: action.stage_role,
        acted_by_user_id: action.acted_by_user_id,
        acted_by_name: action.acted_by_name,
        acted_by_role: action.acted_by_role,
        action: action.action,
        remarks: action.remarks,
        payload_json: action.payload_json || null,
        action_at: action.action_at,
      }))
      .sort((a, b) => new Date(a.action_at) - new Date(b.action_at) || a.id - b.id);

    const attachments = (p.attachments || [])
      .map((attachment) => ({
        id: attachment.id,
        requisition_id: attachment.requisition_id,
        action_id: attachment.action_id,
        attachment_type: attachment.attachment_type,
        file_url: attachment.file_url,
        file_name: attachment.file_name,
        mime_type: attachment.mime_type,
        uploaded_by_user_id: attachment.uploaded_by_user_id,
        uploaded_by_name: attachment.uploaded_by_name,
        createdAt: attachment.createdAt,
      }))
      .sort((a, b) => a.id - b.id);

    return {
      id: p.id,
      req_no: p.req_no,
      requester_serial_no: p.requester_serial_no,
      requester_user_id: p.requester_user_id,
      requester_emp_id: p.requester_emp_id,
      requester_name: p.requester_name,
      requester_division: p.requester_division,
      location_scope: p.location_scope || null,
      purpose: p.purpose,
      status: p.status,
      current_stage_order: p.current_stage_order,
      current_stage_role: p.current_stage_role,
      current_stage_role_display: currentStageRoleDisplay,
      submitted_at: p.submitted_at,
      final_approved_at: p.final_approved_at,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      items,
      actions,
      attachments,
    };
  }

  async _loadItemLookups(items = [], transaction) {
    const stockIds = [
      ...new Set(items.map((item) => toPositiveId(item.stock_id)).filter(Boolean)),
    ];
    const categoryIds = [
      ...new Set(items.map((item) => toPositiveId(item.item_category_id)).filter(Boolean)),
    ];

    const [stocks, categories] = await Promise.all([
      stockIds.length
        ? Stock.findAll({
            where: { id: stockIds },
            attributes: ["id", "item_name", "item_category_id", "item_master_id", "sku_unit"],
            transaction,
          })
        : [],
      categoryIds.length
        ? ItemCategory.findAll({
            where: { id: categoryIds },
            attributes: ["id", "category_name"],
            transaction,
          })
        : [],
    ]);

    return {
      stockMap: new Map(stocks.map((row) => [Number(row.id), row])),
      categoryMap: new Map(categories.map((row) => [Number(row.id), row])),
    };
  }

  async create({
    requesterUserId,
    requesterEmpId = null,
    requesterName = null,
    requesterDivision = null,
    requesterLocationScope = null,
    purpose = null,
    remarks = null,
    items = [],
    initialStage = null,
    autoSubmit = true,
  }) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("At least one requisition item is required.");
    }

    return sequelize.transaction(async (transaction) => {
      const now = new Date();
      const { stockMap, categoryMap } = await this._loadItemLookups(
        items,
        transaction,
      );
      const lastRequesterRequisition = await Requisition.findOne({
        where: { requester_user_id: requesterUserId },
        attributes: ["id", "requester_serial_no"],
        order: [
          ["requester_serial_no", "DESC"],
          ["id", "DESC"],
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const nextRequesterSerial =
        Math.max(0, toNumber(lastRequesterRequisition?.requester_serial_no) || 0) + 1;

      const preparedItems = [];
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const requestedQty = toQty(item.requested_qty ?? item.qty_required);
        if (requestedQty <= 0) {
          throw new Error(`Item ${index + 1}: requested_qty must be greater than 0.`);
        }

        const stockId = toPositiveId(item.stock_id);
        const categoryId =
          toPositiveId(item.item_category_id) ||
          toPositiveId(stockId ? stockMap.get(stockId)?.item_category_id : null);
        const stockName = stockId ? stockMap.get(stockId)?.item_name : null;
        const stockSkuUnit = stockId ? stockMap.get(stockId)?.sku_unit || "Unit" : "Unit";
        const stockItemMasterId = toPositiveId(
          stockId ? stockMap.get(stockId)?.item_master_id : null,
        );
        const requestedSkuUnit = normalizeSkuUnit(item.sku_unit ?? stockSkuUnit);
        const categoryName = categoryId ? categoryMap.get(categoryId)?.category_name : null;
        const particulars = String(
          item.particulars || stockName || categoryName || `Item ${index + 1}`,
        )
          .trim()
          .slice(0, 255);

        if (!particulars) {
          throw new Error(`Item ${index + 1}: particulars cannot be empty.`);
        }
        if (stockId && !sameSkuUnit(requestedSkuUnit, stockSkuUnit)) {
          throw new Error(
            `Item ${index + 1}: sku_unit mismatch. Stock uses ${stockSkuUnit}.`,
          );
        }

        let itemMasterId = stockItemMasterId;
        if (!itemMasterId && categoryId) {
          const ensuredItemMaster = await ensureItemMaster({
            itemCategoryId: categoryId,
            skuUnit: requestedSkuUnit,
            itemName: particulars,
            aliasText: particulars,
            transaction,
          });
          itemMasterId = toPositiveId(ensuredItemMaster?.id);
        }

        preparedItems.push({
          item_no: toNumber(item.item_no) || index + 1,
          stock_id: stockId,
          item_master_id: itemMasterId,
          item_category_id: categoryId,
          particulars,
          sku_unit: requestedSkuUnit,
          requested_qty: requestedQty,
          approved_qty: requestedQty,
          issued_qty: 0,
          item_status: "Pending",
          remarks: item.remarks || null,
        });
      }

      const hasStage = Boolean(initialStage?.role_name);
      const status = autoSubmit
        ? hasStage
          ? "Submitted"
          : "Approved"
        : "Draft";

      const requisition = await Requisition.create(
        {
          req_no: this._buildReqNo({
            requesterEmpId,
            requesterUserId,
            requesterSerialNo: nextRequesterSerial,
          }),
          requester_serial_no: nextRequesterSerial,
          requester_user_id: requesterUserId,
          requester_emp_id: requesterEmpId,
          requester_name: requesterName,
          requester_division: requesterDivision,
          location_scope: requesterLocationScope || null,
          purpose: purpose || null,
          status,
          current_stage_order: autoSubmit && hasStage ? initialStage.stage_order : null,
          current_stage_role: autoSubmit && hasStage ? initialStage.role_name : null,
          submitted_at: autoSubmit ? now : null,
          final_approved_at: autoSubmit && !hasStage ? now : null,
        },
        { transaction },
      );

      const itemRows = preparedItems.map((item) => ({
        ...item,
        requisition_id: requisition.id,
      }));

      await RequisitionItem.bulkCreate(itemRows, { transaction });

      await RequisitionAction.create(
        {
          requisition_id: requisition.id,
          requisition_item_id: null,
          stage_order: null,
          stage_role: null,
          acted_by_user_id: requesterUserId,
          acted_by_name: requesterName,
          acted_by_role: "REQUESTER",
          action: "Create",
          remarks: remarks || null,
          payload_json: {
            item_count: itemRows.length,
            autoSubmit: Boolean(autoSubmit),
          },
          action_at: now,
        },
        { transaction },
      );

      if (autoSubmit) {
        await RequisitionAction.create(
          {
            requisition_id: requisition.id,
            requisition_item_id: null,
            stage_order: hasStage ? initialStage.stage_order : null,
            stage_role: hasStage ? initialStage.role_name : null,
            acted_by_user_id: requesterUserId,
            acted_by_name: requesterName,
            acted_by_role: "REQUESTER",
            action: "Submit",
            remarks: remarks || null,
            payload_json: {
              forwarded_to: hasStage ? initialStage.role_name : "FINAL",
            },
            action_at: now,
          },
          { transaction },
        );
      }

      const created = await this.getById(requisition.id, transaction);
      return created;
    });
  }

  async getById(requisitionId, transaction = null) {
    const row = await Requisition.findByPk(requisitionId, {
      transaction: transaction || undefined,
      include: [
        {
          model: RequisitionItem,
          as: "items",
          required: false,
          include: [
            {
              model: ItemCategory,
              as: "itemCategory",
              required: false,
              attributes: ["id", "category_name"],
            },
            {
              model: Stock,
              as: "stock",
              required: false,
              attributes: ["id", "item_name", "quantity", "sku_unit"],
            },
          ],
        },
        {
          model: RequisitionAction,
          as: "actions",
          required: false,
        },
        {
          model: RequisitionAttachment,
          as: "attachments",
          required: false,
        },
      ],
    });

    return row ? this._mapDetail(row) : null;
  }

  async mapItems({
    requisitionId,
    mappings = [],
    actor = {},
    requireComplete = true,
  }) {
    const actorUserId = toNumber(actor?.id);
    if (!actorUserId) throw new Error("Invalid user.");

    const actorRoles = this._normalizeRoles(actor?.roles || []);
    const isStoreMapper =
      actorRoles.includes("STORE_ENTRY") || actorRoles.includes("SUPER_ADMIN");
    if (!isStoreMapper) {
      const error = new Error("Only store users can map requisition items.");
      error.statusCode = 403;
      throw error;
    }

    if (!Array.isArray(mappings) || mappings.length === 0) {
      throw new Error("At least one item mapping is required.");
    }

    return sequelize.transaction(async (transaction) => {
      const requisition = await Requisition.findByPk(requisitionId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!requisition) throw new Error("Requisition not found.");
      assertActorCanAccessLocation(
        actor || {},
        requisition.location_scope,
        "map store items for this requisition",
      );

      if (!["Approved", "PartiallyApproved", "Fulfilling"].includes(String(requisition.status))) {
        throw new Error("Item mapping is allowed only for store-queue requisitions.");
      }

      const items = await RequisitionItem.findAll({
        where: { requisition_id: requisition.id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const itemMap = new Map(items.map((item) => [Number(item.id), item]));

      const stockIds = [
        ...new Set(
          mappings.map((m) => toPositiveId(m?.stock_id)).filter(Boolean),
        ),
      ];
      const explicitCategoryIds = [
        ...new Set(
          mappings.map((m) => toPositiveId(m?.item_category_id)).filter(Boolean),
        ),
      ];

      const [stocks, categories] = await Promise.all([
        stockIds.length
          ? Stock.findAll({
              where: {
                id: stockIds,
                is_active: true,
                location_scope: requisition.location_scope,
              },
              attributes: ["id", "item_category_id", "item_master_id", "item_name", "sku_unit"],
              transaction,
            })
          : [],
        explicitCategoryIds.length
          ? ItemCategory.findAll({
              where: { id: explicitCategoryIds },
              attributes: ["id"],
              transaction,
            })
          : [],
      ]);

      const stockMap = new Map(stocks.map((row) => [Number(row.id), row]));
      const categorySet = new Set(categories.map((row) => Number(row.id)));
      const now = new Date();
      const mappedActionRows = [];
      const itemIds = Array.from(itemMap.keys());

      const existingStoreRemarkActions = itemIds.length
        ? await RequisitionAction.findAll({
            where: {
              requisition_id: requisition.id,
              requisition_item_id: { [Op.in]: itemIds },
              stage_role: "STORE_ENTRY",
              action: { [Op.in]: ["MapItem", "QtyReduce"] },
              remarks: { [Op.ne]: null },
            },
            attributes: ["requisition_item_id", "remarks", "action_at", "id"],
            order: [
              ["action_at", "ASC"],
              ["id", "ASC"],
            ],
            transaction,
          })
        : [];
      const latestStoreRemarkByItem = new Map();
      for (const actionRow of existingStoreRemarkActions) {
        const itemId = toNumber(actionRow?.requisition_item_id);
        const remarks =
          actionRow?.remarks === undefined || actionRow?.remarks === null
            ? ""
            : String(actionRow.remarks).trim();
        if (itemId && remarks) {
          latestStoreRemarkByItem.set(itemId, remarks);
        }
      }

      for (const mapping of mappings) {
        const itemId = toNumber(mapping?.requisition_item_id);
        if (!itemId || !itemMap.has(itemId)) {
          throw new Error(`Invalid requisition item id: ${mapping?.requisition_item_id}`);
        }

        const item = itemMap.get(itemId);
        const requestedQty = toQty(item.requested_qty);
        const currentApprovedQty = toQty(item.approved_qty);
        const currentIssuedQty = toQty(item.issued_qty);
        const beforeSkuUnit = normalizeSkuUnit(item.sku_unit || "Unit");

        const stockId = toPositiveId(mapping?.stock_id);
        const explicitCategoryId = toPositiveId(mapping?.item_category_id);

        if (!stockId && !explicitCategoryId) {
          throw new Error(`Item ${item.item_no || item.id}: map stock and category.`);
        }

        let resolvedCategoryId = explicitCategoryId;
        let stockCategoryId = null;
        let stockSkuUnit = null;
        let stockItemMasterId = null;
        let stockItemName = null;

        if (stockId) {
          const stock = stockMap.get(stockId);
          if (!stock) {
            throw new Error(`Invalid or inactive stock id: ${stockId}`);
          }
          stockItemName = stock.item_name || null;
          stockCategoryId = toPositiveId(stock.item_category_id);
          stockItemMasterId = toPositiveId(stock.item_master_id);
          stockSkuUnit = normalizeSkuUnit(stock.sku_unit || "Unit");
          if (!stockCategoryId) {
            throw new Error(`Stock ${stockId} is not linked to any category.`);
          }
          resolvedCategoryId = resolvedCategoryId || stockCategoryId;
        }

        if (!resolvedCategoryId) {
          throw new Error(`Item ${item.item_no || item.id}: item category is required.`);
        }

        if (explicitCategoryId && !categorySet.has(explicitCategoryId)) {
          throw new Error(`Invalid item category id: ${explicitCategoryId}`);
        }

        const beforeStockId = toPositiveId(item.stock_id);
        const beforeCategoryId = toPositiveId(item.item_category_id);
        const beforeItemMasterId = toPositiveId(item.item_master_id);
        const beforeApprovedQty = currentApprovedQty;
        const nextSkuUnit = normalizeSkuUnit(
          mapping?.sku_unit ?? mapping?.skuUnit ?? stockSkuUnit ?? beforeSkuUnit,
        );

        if (
          stockCategoryId &&
          resolvedCategoryId &&
          Number(stockCategoryId) !== Number(resolvedCategoryId)
        ) {
          throw new Error(
            `Item ${item.item_no || item.id}: selected stock/category mismatch.`,
          );
        }
        if (stockSkuUnit && !sameSkuUnit(nextSkuUnit, stockSkuUnit)) {
          throw new Error(
            `Item ${item.item_no || item.id}: selected stock/unit mismatch.`,
          );
        }

        const baselineItemRemarks =
          item?.remarks === undefined || item?.remarks === null
            ? null
            : String(item.remarks);
        const beforeRemarks = latestStoreRemarkByItem.has(itemId)
          ? latestStoreRemarkByItem.get(itemId)
          : baselineItemRemarks;
        const beforeItemStatus = String(item.item_status || "");
        const nextStockId = stockId || beforeStockId;
        const nextCategoryId = resolvedCategoryId;
        let nextItemMasterId = stockItemMasterId || beforeItemMasterId;
        if (!nextItemMasterId && nextCategoryId) {
          const ensuredItemMaster = await ensureItemMaster({
            itemCategoryId: nextCategoryId,
            skuUnit: nextSkuUnit,
            itemName: stockItemName || item.particulars || `Item ${item.item_no || item.id}`,
            aliasText: item.particulars || stockItemName || null,
            transaction,
          });
          nextItemMasterId = toPositiveId(ensuredItemMaster?.id);
        }
        const hasApprovedInPayload =
          mapping?.approved_qty !== undefined &&
          mapping?.approved_qty !== null &&
          !(typeof mapping.approved_qty === "string" && mapping.approved_qty.trim() === "");
        let nextApprovedQty = currentApprovedQty;
        if (hasApprovedInPayload) {
          const parsedWholeQty = toWholeQty(mapping.approved_qty);
          if (parsedWholeQty === null) {
            throw new Error(
              `Item ${item.item_no || item.id}: approved qty must be a whole number (0, 1, 2...).`,
            );
          }
          nextApprovedQty = parsedWholeQty;
        }

        if (nextApprovedQty - currentApprovedQty > 0.0001) {
          throw new Error(
            `Item ${item.item_no || item.id}: store can only reduce or keep approved qty.`,
          );
        }
        if (currentIssuedQty - nextApprovedQty > 0.0001) {
          throw new Error(
            `Item ${item.item_no || item.id}: approved qty cannot be less than issued qty (${currentIssuedQty}).`,
          );
        }

        const hasRemarksInPayload = mapping?.remarks !== undefined;
        const nextRemarksRaw = hasRemarksInPayload ? mapping?.remarks : beforeRemarks;
        const nextRemarks =
          nextRemarksRaw === undefined || nextRemarksRaw === null
            ? null
            : String(nextRemarksRaw).trim() || null;
        const hasQtyChange = Math.abs(nextApprovedQty - beforeApprovedQty) > 0.0001;

        if (hasQtyChange && !nextRemarks) {
          throw new Error(
            `Item ${item.item_no || item.id}: remarks are required when reducing qty.`,
          );
        }

        let nextItemStatus = beforeItemStatus;
        if (nextApprovedQty <= 0) {
          nextItemStatus = "Rejected";
        } else if (currentIssuedQty >= nextApprovedQty - 0.0001) {
          nextItemStatus = "Fulfilled";
        } else if (nextApprovedQty < requestedQty) {
          nextItemStatus = "PartiallyApproved";
        } else {
          nextItemStatus = "Approved";
        }

        const hasMappingChange =
          Number(beforeStockId || 0) !== Number(nextStockId || 0) ||
          Number(beforeCategoryId || 0) !== Number(nextCategoryId || 0) ||
          Number(beforeItemMasterId || 0) !== Number(nextItemMasterId || 0) ||
          !sameSkuUnit(beforeSkuUnit, nextSkuUnit);
        const hasRemarksChange = String(beforeRemarks || "") !== String(nextRemarks || "");
        const hasStatusChange = String(beforeItemStatus || "") !== String(nextItemStatus || "");
        const hasChange =
          hasMappingChange || hasQtyChange || hasRemarksChange || hasStatusChange;

        await item.update(
          {
            stock_id: nextStockId,
            item_category_id: nextCategoryId,
            item_master_id: nextItemMasterId,
            sku_unit: nextSkuUnit,
            approved_qty: nextApprovedQty,
            item_status: nextItemStatus,
          },
          { transaction },
        );

        if (hasChange) {
          mappedActionRows.push({
            requisition_id: requisition.id,
            requisition_item_id: item.id,
            stage_order: null,
            stage_role: "STORE_ENTRY",
            acted_by_user_id: actorUserId,
            acted_by_name: actor?.fullname || actor?.name || null,
            acted_by_role: "STORE_ENTRY",
            action: hasQtyChange ? "QtyReduce" : "MapItem",
            remarks: nextRemarks,
            payload_json: {
              before: {
                stock_id: beforeStockId,
                item_category_id: beforeCategoryId,
                item_master_id: beforeItemMasterId,
                sku_unit: beforeSkuUnit,
                approved_qty: beforeApprovedQty,
                item_status: beforeItemStatus,
                remarks: beforeRemarks,
              },
              after: {
                stock_id: nextStockId,
                item_category_id: nextCategoryId,
                item_master_id: nextItemMasterId,
                sku_unit: nextSkuUnit,
                approved_qty: nextApprovedQty,
                item_status: nextItemStatus,
                remarks: nextRemarks,
              },
            },
            action_at: now,
          });
        }
      }

      if (requireComplete) {
        const refreshedItems = await RequisitionItem.findAll({
          where: { requisition_id: requisition.id },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        const incomplete = refreshedItems.filter((item) => {
          if (TERMINAL_ITEM_STATUSES.has(String(item.item_status || ""))) return false;
          const remaining = Math.max(
            0,
            toQty(item.approved_qty) - toQty(item.issued_qty),
          );
          if (remaining <= 0) return false;
          return !toPositiveId(item.item_category_id) || !toPositiveId(item.stock_id);
        });

        if (incomplete.length > 0) {
          const itemNos = incomplete.map((it) => it.item_no || it.id).join(", ");
          throw new Error(
            `Complete mapping for all pending requisition items. Missing: ${itemNos}`,
          );
        }
      }

      if (mappedActionRows.length) {
        await RequisitionAction.bulkCreate(mappedActionRows, { transaction });
      }

      return this.getById(requisition.id, transaction);
    });
  }

  async list({
    scope = "my",
    page = 1,
    limit = 50,
    cursor = null,
    cursorMode = false,
    status = "",
    search = "",
    fromDate = "",
    toDate = "",
    viewerUserId = null,
    viewerDivision = null,
    viewerRoles = [],
    viewerAssignments = [],
    viewerActor = {},
    viewerStageOrders = [],
    firstStageOrder = null,
  }) {
    const normalizedScope = normalizeScope(scope);
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = normalizeLimit(limit, 50, 500);
    const offset = (safePage - 1) * safeLimit;
    const useCursorMode = Boolean(cursorMode);
    const normalizedRoles = this._normalizeRoles(viewerRoles);
    const normalizedStageOrders = [...new Set(
      (viewerStageOrders || [])
        .map((stageOrder) => toNumber(stageOrder))
        .filter((stageOrder) => Number.isFinite(stageOrder)),
    )];
    const resolvedViewerUserId = toNumber(viewerUserId);

    const where = {};
    const locationWhere = buildLocationScopeWhere(viewerActor || {});
    if (locationWhere) {
      Object.assign(where, locationWhere);
    }

    if (status) where.status = String(status).trim();

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt[Op.gte] = new Date(`${fromDate}T00:00:00.000`);
      if (toDate) where.createdAt[Op.lte] = new Date(`${toDate}T23:59:59.999`);
    }

    const q = String(search || "").trim();
    if (q) {
      const like = `%${q}%`;
      where[Op.or] = [
        { req_no: { [Op.like]: like } },
        { requester_name: { [Op.like]: like } },
        { requester_emp_id: { [Op.like]: like } },
        { requester_division: { [Op.like]: like } },
        { purpose: { [Op.like]: like } },
      ];
    }

    if (normalizedScope === "my") {
      where.requester_user_id = toNumber(viewerUserId) || -1;
    } else if (normalizedScope === "inbox") {
      // Inbox should show only requisitions already worked by this account.
      if (Number.isFinite(resolvedViewerUserId)) {
        const actedRows = await RequisitionAction.findAll({
          attributes: [
            [
              sequelize.fn("DISTINCT", sequelize.col("requisition_id")),
              "requisition_id",
            ],
          ],
          where: {
            acted_by_user_id: resolvedViewerUserId,
          },
          raw: true,
        });
        const actedReqIds = actedRows
          .map((row) => toNumber(row?.requisition_id))
          .filter((id) => Number.isFinite(id));
        if (actedReqIds.length) {
          where.id = { [Op.in]: actedReqIds };
        } else {
          where.id = -1;
        }
      } else {
        where.id = -1;
      }
    } else if (normalizedScope === "store") {
      const isStoreViewer =
        normalizedRoles.includes("STORE_ENTRY") ||
        normalizedRoles.includes("SUPER_ADMIN");
      if (isStoreViewer) {
        // Queue for store-level users: items pending at store stage.
        where.status = {
          [Op.in]: ["Approved", "PartiallyApproved", "Fulfilling"],
        };
      } else if (normalizedStageOrders.length) {
        // Queue for approver-level users: items pending at their approval stage.
        where.status = { [Op.in]: ACTIVE_REVIEW_STATUSES };
        where.current_stage_order = { [Op.in]: normalizedStageOrders };

        const hasDivisionMatchConstraint =
          Number.isFinite(toNumber(firstStageOrder)) &&
          normalizedStageOrders.includes(toNumber(firstStageOrder));

        if (hasDivisionMatchConstraint) {
          const firstStage = toNumber(firstStageOrder);
          const scopedOr = [{ current_stage_order: { [Op.ne]: firstStage } }];
          const scopedDivisions = getAssignmentScopeValues(
            viewerAssignments,
            "DIVISION_HEAD",
          );

          if (scopedDivisions.length) {
            scopedOr.push({
              current_stage_order: firstStage,
              requester_division: { [Op.in]: scopedDivisions },
            });
          } else if (String(viewerDivision || "").trim()) {
            scopedOr.push({
              current_stage_order: firstStage,
              requester_division: String(viewerDivision).trim(),
            });
          }

          const existingAnd = Array.isArray(where[Op.and]) ? where[Op.and] : [];
          where[Op.and] = [...existingAnd, { [Op.or]: scopedOr }];
        }
      } else if (Number.isFinite(resolvedViewerUserId) && normalizedRoles.includes("USER")) {
        // Queue for requester-level users (employee/user):
        // their own requisitions still pending in workflow.
        where.requester_user_id = resolvedViewerUserId;
        where.status = {
          [Op.in]: ["Draft", "Submitted", "InReview", "PartiallyApproved", "Approved", "Fulfilling"],
        };
      } else if (normalizedRoles.length) {
        // Fallback when stage-order mapping is unavailable:
        // match pending queue by current stage role directly.
        where.status = { [Op.in]: ACTIVE_REVIEW_STATUSES };
        where.current_stage_role = { [Op.in]: normalizedRoles };
      } else {
        where.id = -1;
      }
    } else if (normalizedScope === "all") {
      const isPrivileged =
        normalizedRoles.includes("SUPER_ADMIN") ||
        normalizedRoles.includes("STORE_ENTRY");
      if (!isPrivileged) {
        where.id = -1;
      }
    }

    const baseQuery = {
      where,
      include: [
        {
          model: RequisitionItem,
          as: "items",
          required: false,
          attributes: [
            "id",
            "sku_unit",
            "requested_qty",
            "approved_qty",
            "issued_qty",
            "item_status",
          ],
        },
      ],
      distinct: true,
      order: [
        ["updatedAt", "DESC"],
        ["id", "DESC"],
      ],
    };

    if (useCursorMode) {
      const cursorParts = decodeCursor(cursor);
      const cursorWhere = applyDateIdDescCursor(where, cursorParts, "updatedAt", "id");
      const rowsWithExtra = await Requisition.findAll({
        ...baseQuery,
        where: cursorWhere,
        limit: safeLimit + 1,
      });

      const hasMore = rowsWithExtra.length > safeLimit;
      const rows = hasMore ? rowsWithExtra.slice(0, safeLimit) : rowsWithExtra;
      const nextCursor =
        hasMore && rows.length
          ? encodeCursor({
              updatedAt:
                rows[rows.length - 1].updatedAt instanceof Date
                  ? rows[rows.length - 1].updatedAt.toISOString()
                  : new Date(rows[rows.length - 1].updatedAt).toISOString(),
              id: rows[rows.length - 1].id,
            })
          : null;

      return {
        rows: rows.map((row) => this._mapSummary(row)),
        meta: {
          limit: safeLimit,
          hasMore,
          nextCursor,
          mode: "cursor",
          scope: normalizedScope,
        },
      };
    }

    const { rows, count } = await Requisition.findAndCountAll({
      ...baseQuery,
      limit: safeLimit,
      offset,
    });

    return {
      rows: rows.map((row) => this._mapSummary(row)),
      meta: {
        page: safePage,
        limit: safeLimit,
        total: count,
        totalPages: Math.max(1, Math.ceil(Number(count || 0) / safeLimit)),
        mode: "offset",
        scope: normalizedScope,
      },
    };
  }

  async getUserDashboardSummary({
    viewerUserId = null,
    queueLimit = 8,
    historyLimit = 8,
    recentLimit = 8,
    actionNeededLimit = 6,
    months = 6,
  }) {
    const safeViewerUserId = toNumber(viewerUserId);
    if (!Number.isFinite(safeViewerUserId)) {
      throw new Error("viewerUserId is required for dashboard summary.");
    }

    const safeQueueLimit = clampLimit(queueLimit, 8, 20);
    const safeHistoryLimit = clampLimit(historyLimit, 8, 20);
    const safeRecentLimit = clampLimit(recentLimit, 8, 20);
    const safeActionLimit = clampLimit(actionNeededLimit, 6, 20);
    const safeMonths = Math.max(3, Math.min(24, clampLimit(months, 6, 24)));

    const baseWhere = { requester_user_id: safeViewerUserId };

    const statusCountsRows = await Requisition.findAll({
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "total"],
      ],
      where: baseWhere,
      group: ["status"],
      raw: true,
    });

    const statusCountMap = new Map(
      statusCountsRows.map((row) => [
        String(row.status || ""),
        Number(row.total || 0),
      ]),
    );

    const getStatusCount = (status) => Number(statusCountMap.get(status) || 0);
    const totalCount = [...statusCountMap.values()].reduce(
      (sum, n) => sum + Number(n || 0),
      0,
    );
    const workflowCount = USER_DASHBOARD_WORKFLOW_STATUSES.reduce(
      (sum, status) => sum + getStatusCount(status),
      0,
    );
    const approvedLikeCount = USER_DASHBOARD_APPROVED_LIKE_STATUSES.reduce(
      (sum, status) => sum + getStatusCount(status),
      0,
    );
    const rejectedCancelledCount =
      getStatusCount("Rejected") + getStatusCount("Cancelled");
    const fulfilledCount = getStatusCount("Fulfilled");

    const workedByMeCount = await RequisitionAction.count({
      distinct: true,
      col: "requisition_id",
      where: { acted_by_user_id: safeViewerUserId },
    });

    const fetchRows = async ({ statuses = null, limit = 10 } = {}) => {
      const where = { ...baseWhere };
      if (Array.isArray(statuses) && statuses.length > 0) {
        where.status = { [Op.in]: statuses };
      }

      const rows = await Requisition.findAll({
        where,
        include: [
          {
            model: RequisitionItem,
            as: "items",
            required: false,
            attributes: [
              "id",
              "sku_unit",
              "requested_qty",
              "approved_qty",
              "issued_qty",
              "item_status",
            ],
          },
        ],
        order: [
          ["updatedAt", "DESC"],
          ["id", "DESC"],
        ],
        limit: clampLimit(limit, 10, 50),
      });

      return rows.map((row) => this._mapSummary(row));
    };

    const [queueRows, historyRows, actionNeededRows, recentActionRows] =
      await Promise.all([
        fetchRows({
          statuses: USER_DASHBOARD_WORKFLOW_STATUSES,
          limit: safeQueueLimit,
        }),
        fetchRows({
          statuses: USER_DASHBOARD_FINAL_STATUSES,
          limit: safeHistoryLimit,
        }),
        fetchRows({
          statuses: USER_DASHBOARD_ACTION_NEEDED_STATUSES,
          limit: safeActionLimit,
        }),
        RequisitionAction.findAll({
          attributes: [
            "id",
            "requisition_id",
            "requisition_item_id",
            "action",
            "stage_role",
            "acted_by_name",
            "acted_by_role",
            "remarks",
            "payload_json",
            "action_at",
          ],
          include: [
            {
              model: Requisition,
              as: "requisition",
              required: true,
              attributes: ["id", "req_no", "status", "purpose"],
              where: { requester_user_id: safeViewerUserId },
            },
            {
              model: RequisitionItem,
              as: "item",
              required: false,
              attributes: [
                "id",
                "item_no",
                "particulars",
                "requested_qty",
                "approved_qty",
                "sku_unit",
              ],
            },
          ],
          order: [
            ["action_at", "DESC"],
            ["id", "DESC"],
          ],
          limit: safeRecentLimit,
        }),
      ]);

    const recentActions = recentActionRows.map((row) => {
      const p = row?.get ? row.get({ plain: true }) : row;
      const payload = p.payload_json || null;
      const beforeQty = toNumber(
        payload?.before_qty ??
          payload?.before?.approved_qty ??
          payload?.before?.qty ??
          null,
      );
      const afterQty = toNumber(
        payload?.after_qty ??
          payload?.after?.approved_qty ??
          payload?.after?.qty ??
          null,
      );
      const requestedQty = toNumber(
        payload?.requested_qty ??
          payload?.requestedQty ??
          p.item?.requested_qty ??
          null,
      );
      const reducedByQty =
        Number.isFinite(beforeQty) && Number.isFinite(afterQty)
          ? Number((beforeQty - afterQty).toFixed(3))
          : null;
      const payloadNextStageRole = String(payload?.next_stage_role || "").trim() || null;
      const stageRoleDisplay =
        payloadNextStageRole ||
        deriveStageRoleDisplay(p.requisition?.status, p.stage_role);
      return {
        id: p.id,
        requisition_id: p.requisition_id,
        requisition_item_id: p.requisition_item_id,
        item_no: p.item?.item_no ?? null,
        item_particulars: p.item?.particulars || null,
        item_sku_unit: p.item?.sku_unit || null,
        req_no: p.requisition?.req_no || null,
        requisition_status: p.requisition?.status || null,
        purpose: p.requisition?.purpose || null,
        action: p.action || null,
        stage_role: p.stage_role || null,
        stage_role_display: stageRoleDisplay,
        acted_by_name: p.acted_by_name || null,
        acted_by_role: p.acted_by_role || null,
        remarks: p.remarks || null,
        payload_json: payload,
        before_qty: beforeQty,
        after_qty: afterQty,
        requested_qty: requestedQty,
        reduced_by_qty: reducedByQty,
        action_at: p.action_at || null,
      };
    });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    monthStart.setMonth(monthStart.getMonth() - (safeMonths - 1));

    const trendRows = await sequelize.query(
      `
      SELECT
        DATE_FORMAT(createdAt, '%Y-%m') AS month_key,
        COUNT(*) AS total
      FROM Requisitions
      WHERE requester_user_id = :viewerUserId
        AND createdAt >= :monthStart
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
      ORDER BY month_key ASC
      `,
      {
        replacements: {
          viewerUserId: safeViewerUserId,
          monthStart,
        },
        type: QueryTypes.SELECT,
      },
    );

    const pendingAgeRows = await sequelize.query(
      `
      SELECT
        COALESCE(
          AVG(
            TIMESTAMPDIFF(HOUR, COALESCE(submitted_at, createdAt), NOW())
          ) / 24,
          0
        ) AS avg_pending_days,
        COALESCE(
          MAX(
            TIMESTAMPDIFF(HOUR, COALESCE(submitted_at, createdAt), NOW())
          ) / 24,
          0
        ) AS max_pending_days
      FROM Requisitions
      WHERE requester_user_id = :viewerUserId
        AND status IN (:workflowStatuses)
      `,
      {
        replacements: {
          viewerUserId: safeViewerUserId,
          workflowStatuses: USER_DASHBOARD_WORKFLOW_STATUSES,
        },
        type: QueryTypes.SELECT,
      },
    );

    const trendMap = new Map(
      (trendRows || []).map((row) => [
        String(row.month_key || ""),
        Number(row.total || 0),
      ]),
    );
    const monthlyTrend = [];
    for (let i = 0; i < safeMonths; i += 1) {
      const d = new Date(monthStart);
      d.setMonth(monthStart.getMonth() + i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleString("en-US", {
        month: "short",
        year: "2-digit",
      });
      monthlyTrend.push({
        month_key: monthKey,
        label: monthLabel,
        total: Number(trendMap.get(monthKey) || 0),
      });
    }

    const pendingAge = Array.isArray(pendingAgeRows) ? pendingAgeRows[0] || {} : {};

    return {
      counts: {
        total: totalCount,
        draft: getStatusCount("Draft"),
        workflow: workflowCount,
        approved_like: approvedLikeCount,
        rejected_cancelled: rejectedCancelledCount,
        fulfilled: fulfilledCount,
        worked_by_me: Number(workedByMeCount || 0),
      },
      pending: {
        avg_days: Number(Number(pendingAge.avg_pending_days || 0).toFixed(1)),
        max_days: Number(Number(pendingAge.max_pending_days || 0).toFixed(1)),
      },
      queue: queueRows,
      history: historyRows,
      recent_actions: recentActions,
      action_needed: actionNeededRows,
      monthly_trend: monthlyTrend,
    };
  }

  _getNextStage(stages = [], currentStageOrder = null) {
    const sorted = [...(stages || [])]
      .map((stage) => ({
        role_name: String(stage?.role_name || ""),
        stage_order: toNumber(stage?.stage_order),
      }))
      .filter((stage) => stage.role_name && Number.isFinite(stage.stage_order))
      .sort((a, b) => a.stage_order - b.stage_order);

    if (!sorted.length) return null;
    const current = toNumber(currentStageOrder);
    const idx = sorted.findIndex((stage) => stage.stage_order === current);
    if (idx < 0) return null;
    return sorted[idx + 1] || null;
  }

  _buildDecisionMap(decisions = []) {
    const map = new Map();
    for (const decision of decisions || []) {
      const itemId = toNumber(decision?.requisition_item_id);
      if (!itemId) continue;
      map.set(itemId, {
        action: String(decision?.action || "approve").trim().toLowerCase(),
        approved_qty: decision?.approved_qty,
        remarks: decision?.remarks || null,
      });
    }
    return map;
  }

  async approve({
    requisitionId,
    actor = {},
    stages = [],
    remarks = null,
    decisions = [],
    firstStageOrder = null,
  }) {
    const actorUserId = toNumber(actor?.id);
    if (!actorUserId) throw new Error("Invalid approver user.");

    return sequelize.transaction(async (transaction) => {
      const requisition = await Requisition.findByPk(requisitionId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!requisition) throw new Error("Requisition not found.");
      assertActorCanAccessLocation(
        actor || {},
        requisition.location_scope,
        "reject this requisition",
      );

      if (FINAL_REQUISITION_STATUSES.has(String(requisition.status || ""))) {
        throw new Error("Requisition is already finalized.");
      }

      const currentStageOrder = toNumber(requisition.current_stage_order);
      const currentStageRole = this._normalizeRoleName(
        requisition.current_stage_role,
      );
      const actorRoles = this._normalizeRoles(actor?.roles || []);
      if (!currentStageRole || !actorRoles.includes(currentStageRole)) {
        throw new Error("You are not allowed to approve this requisition.");
      }

      const firstStage = toNumber(firstStageOrder);
      if (
        Number.isFinite(firstStage) &&
        currentStageOrder === firstStage &&
        String(requisition.requester_division || "").trim()
      ) {
        const hasDivisionHeadAssignment = hasMatchingAssignmentScope(
          actor?.assignments,
          "DIVISION_HEAD",
          requisition.requester_division,
        );
        const viewerDivision = String(actor?.division || "").trim();
        if (
          !hasDivisionHeadAssignment &&
          (!viewerDivision || !eqText(viewerDivision, requisition.requester_division))
        ) {
          throw new Error(
            "You can approve first-stage requisitions only for your own division.",
          );
        }
      }

      const items = await RequisitionItem.findAll({
        where: { requisition_id: requisition.id },
        order: [
          ["item_no", "ASC"],
          ["id", "ASC"],
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!items.length) {
        throw new Error("No requisition items found.");
      }

      const decisionMap = this._buildDecisionMap(decisions);
      const now = new Date();

      const itemActionRows = [];
      let hasAnyActiveApprovedItem = false;
      let hasAnyRejectedItem = false;
      let hasAnyQtyReduction = false;

      for (const item of items) {
        const existingStatus = String(item.item_status || "Pending");
        const requestedQty = toQty(item.requested_qty);
        const currentApprovedQty = toQty(item.approved_qty || requestedQty);

        if (TERMINAL_ITEM_STATUSES.has(existingStatus)) {
          if (existingStatus === "Rejected") hasAnyRejectedItem = true;
          continue;
        }

        const decision = decisionMap.get(item.id);
        const action = String(decision?.action || "approve");
        const beforeQty = currentApprovedQty;
        let nextQty = currentApprovedQty;
        let nextItemStatus = existingStatus;
        let itemAction = null;

        if (action === "reject") {
          nextQty = 0;
          nextItemStatus = "Rejected";
          itemAction = "Reject";
          hasAnyRejectedItem = true;
        } else if (action === "reduce") {
          const reducedQty = toWholeQty(decision?.approved_qty);
          if (reducedQty === null) {
            throw new Error(
              `Item ${item.item_no || item.id}: reduced qty must be a whole number (0, 1, 2...).`,
            );
          }
          nextQty = Math.min(requestedQty, reducedQty);
          if (nextQty <= 0) {
            nextQty = 0;
            nextItemStatus = "Rejected";
            itemAction = "Reject";
            hasAnyRejectedItem = true;
          } else {
            nextItemStatus =
              nextQty < requestedQty ? "PartiallyApproved" : "Approved";
            itemAction = nextQty < beforeQty ? "QtyReduce" : "Approve";
            hasAnyQtyReduction = nextQty < beforeQty;
          }
        } else {
          nextQty = currentApprovedQty > 0 ? currentApprovedQty : requestedQty;
          nextItemStatus =
            nextQty < requestedQty ? "PartiallyApproved" : "Approved";
          itemAction = "Approve";
        }

        if (nextQty > 0) hasAnyActiveApprovedItem = true;

        await item.update(
          {
            approved_qty: nextQty,
            item_status: nextItemStatus,
          },
          { transaction },
        );

        if (itemAction) {
          itemActionRows.push({
            requisition_id: requisition.id,
            requisition_item_id: item.id,
            stage_order: currentStageOrder,
            stage_role: currentStageRole,
            acted_by_user_id: actorUserId,
            acted_by_name: actor?.fullname || actor?.name || null,
            acted_by_role: currentStageRole,
            action: itemAction,
            remarks: decision?.remarks || null,
            payload_json: {
              before_qty: beforeQty,
              after_qty: nextQty,
              requested_qty: requestedQty,
            },
            action_at: now,
          });
        }
      }

      if (itemActionRows.length) {
        await RequisitionAction.bulkCreate(itemActionRows, { transaction });
      }

      let headerAction = "Approve";
      let nextStatus = requisition.status;
      let nextStageOrder = null;
      let nextStageRole = null;
      let finalApprovedAt = requisition.final_approved_at;

      if (!hasAnyActiveApprovedItem) {
        nextStatus = "Rejected";
        headerAction = "Reject";
      } else {
        const nextStage = this._getNextStage(stages, currentStageOrder);
        if (nextStage) {
          nextStatus = "InReview";
          nextStageOrder = nextStage.stage_order;
          nextStageRole = nextStage.role_name;
          headerAction = "Forward";

          await RequisitionItem.update(
            { item_status: "Pending" },
            {
              where: {
                requisition_id: requisition.id,
                approved_qty: { [Op.gt]: 0 },
                item_status: { [Op.notIn]: ["Rejected", "Cancelled", "Fulfilled"] },
              },
              transaction,
            },
          );
        } else {
          nextStatus = hasAnyRejectedItem || hasAnyQtyReduction
            ? "PartiallyApproved"
            : "Approved";
          headerAction = "Approve";
          finalApprovedAt = now;

          const finalItems = await RequisitionItem.findAll({
            where: { requisition_id: requisition.id },
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          for (const item of finalItems) {
            const approvedQty = toQty(item.approved_qty);
            const requestedQty = toQty(item.requested_qty);
            if (approvedQty <= 0) {
              await item.update({ item_status: "Rejected" }, { transaction });
              continue;
            }
            await item.update(
              {
                item_status:
                  approvedQty < requestedQty ? "PartiallyApproved" : "Approved",
              },
              { transaction },
            );
          }
        }
      }

      await requisition.update(
        {
          status: nextStatus,
          current_stage_order: nextStageOrder,
          current_stage_role: nextStageRole,
          final_approved_at:
            nextStatus === "Approved" || nextStatus === "PartiallyApproved"
              ? finalApprovedAt
              : null,
        },
        { transaction },
      );

      await RequisitionAction.create(
        {
          requisition_id: requisition.id,
          requisition_item_id: null,
          stage_order: currentStageOrder,
          stage_role: currentStageRole,
          acted_by_user_id: actorUserId,
          acted_by_name: actor?.fullname || actor?.name || null,
          acted_by_role: currentStageRole,
          action: headerAction,
          remarks: remarks || null,
          payload_json: {
            next_status: nextStatus,
            next_stage_order: nextStageOrder,
            next_stage_role: nextStageRole,
          },
          action_at: now,
        },
        { transaction },
      );

      return this.getById(requisition.id, transaction);
    });
  }

  async reject({
    requisitionId,
    actor = {},
    remarks = null,
    firstStageOrder = null,
  }) {
    const actorUserId = toNumber(actor?.id);
    if (!actorUserId) throw new Error("Invalid approver user.");

    return sequelize.transaction(async (transaction) => {
      const requisition = await Requisition.findByPk(requisitionId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!requisition) throw new Error("Requisition not found.");
      assertActorCanAccessLocation(
        actor || {},
        requisition.location_scope,
        "submit this requisition",
      );

      const currentStageOrder = toNumber(requisition.current_stage_order);
      const currentStageRole = this._normalizeRoleName(
        requisition.current_stage_role,
      );
      const actorRoles = this._normalizeRoles(actor?.roles || []);
      if (!currentStageRole || !actorRoles.includes(currentStageRole)) {
        throw new Error("You are not allowed to reject this requisition.");
      }

      const firstStage = toNumber(firstStageOrder);
      if (
        Number.isFinite(firstStage) &&
        currentStageOrder === firstStage &&
        String(requisition.requester_division || "").trim()
      ) {
        const hasDivisionHeadAssignment = hasMatchingAssignmentScope(
          actor?.assignments,
          "DIVISION_HEAD",
          requisition.requester_division,
        );
        const viewerDivision = String(actor?.division || "").trim();
        if (
          !hasDivisionHeadAssignment &&
          (!viewerDivision || !eqText(viewerDivision, requisition.requester_division))
        ) {
          throw new Error(
            "You can reject first-stage requisitions only for your own division.",
          );
        }
      }

      await RequisitionItem.update(
        {
          approved_qty: 0,
          item_status: "Rejected",
        },
        {
          where: {
            requisition_id: requisition.id,
            item_status: { [Op.notIn]: ["Cancelled", "Fulfilled"] },
          },
          transaction,
        },
      );

      await requisition.update(
        {
          status: "Rejected",
          current_stage_order: null,
          current_stage_role: null,
          final_approved_at: null,
        },
        { transaction },
      );

      await RequisitionAction.create(
        {
          requisition_id: requisition.id,
          requisition_item_id: null,
          stage_order: currentStageOrder,
          stage_role: currentStageRole,
          acted_by_user_id: actorUserId,
          acted_by_name: actor?.fullname || actor?.name || null,
          acted_by_role: currentStageRole,
          action: "Reject",
          remarks: remarks || null,
          payload_json: {
            next_status: "Rejected",
          },
          action_at: new Date(),
        },
        { transaction },
      );

      return this.getById(requisition.id, transaction);
    });
  }

  async submitDraft({
    requisitionId,
    actor = {},
    initialStage = null,
    remarks = null,
  }) {
    const actorUserId = toNumber(actor?.id);
    if (!actorUserId) throw new Error("Invalid user.");

    return sequelize.transaction(async (transaction) => {
      const requisition = await Requisition.findByPk(requisitionId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!requisition) throw new Error("Requisition not found.");
      assertActorCanAccessLocation(
        actor || {},
        requisition.location_scope,
        "cancel this requisition",
      );

      if (String(requisition.status) !== "Draft") {
        throw new Error("Only draft requisition can be submitted.");
      }
      if (toNumber(requisition.requester_user_id) !== actorUserId) {
        throw new Error("Only the creator can submit the draft requisition.");
      }

      const now = new Date();
      const hasStage = Boolean(initialStage?.role_name);

      await requisition.update(
        {
          status: hasStage ? "Submitted" : "Approved",
          current_stage_order: hasStage ? initialStage.stage_order : null,
          current_stage_role: hasStage ? initialStage.role_name : null,
          submitted_at: now,
          final_approved_at: hasStage ? null : now,
        },
        { transaction },
      );

      await RequisitionAction.create(
        {
          requisition_id: requisition.id,
          requisition_item_id: null,
          stage_order: hasStage ? initialStage.stage_order : null,
          stage_role: hasStage ? initialStage.role_name : null,
          acted_by_user_id: actorUserId,
          acted_by_name: actor?.fullname || actor?.name || null,
          acted_by_role: "REQUESTER",
          action: "Submit",
          remarks: remarks || null,
          payload_json: {
            forwarded_to: hasStage ? initialStage.role_name : "FINAL",
          },
          action_at: now,
        },
        { transaction },
      );

      return this.getById(requisition.id, transaction);
    });
  }

  async cancel({
    requisitionId,
    actor = {},
    remarks = null,
  }) {
    const actorUserId = toNumber(actor?.id);
    if (!actorUserId) throw new Error("Invalid user.");
    const actorRoles = this._normalizeRoles(actor?.roles || []);

    return sequelize.transaction(async (transaction) => {
      const requisition = await Requisition.findByPk(requisitionId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!requisition) throw new Error("Requisition not found.");

      const isCreator = toNumber(requisition.requester_user_id) === actorUserId;
      const isPrivileged =
        actorRoles.includes("SUPER_ADMIN") || actorRoles.includes("STORE_ENTRY");
      if (!isCreator && !isPrivileged) {
        throw new Error("You are not allowed to cancel this requisition.");
      }

      if (FINAL_REQUISITION_STATUSES.has(String(requisition.status))) {
        throw new Error("Cannot cancel a finalized requisition.");
      }

      await RequisitionItem.update(
        { item_status: "Cancelled" },
        {
          where: {
            requisition_id: requisition.id,
            item_status: { [Op.notIn]: ["Rejected", "Fulfilled"] },
          },
          transaction,
        },
      );

      await requisition.update(
        {
          status: "Cancelled",
          current_stage_order: null,
          current_stage_role: null,
          final_approved_at: null,
        },
        { transaction },
      );

      await RequisitionAction.create(
        {
          requisition_id: requisition.id,
          requisition_item_id: null,
          stage_order: null,
          stage_role: null,
          acted_by_user_id: actorUserId,
          acted_by_name: actor?.fullname || actor?.name || null,
          acted_by_role: actorRoles[0] || "REQUESTER",
          action: "Cancel",
          remarks: remarks || null,
          payload_json: null,
          action_at: new Date(),
        },
        { transaction },
      );

      return this.getById(requisition.id, transaction);
    });
  }

  async addAttachment({
    requisitionId,
    actionId = null,
    attachmentType = "Supporting",
    fileUrl,
    fileName = null,
    mimeType = null,
    actor = {},
    transaction = null,
  }) {
    const actorUserId = toNumber(actor?.id);
    if (!actorUserId) throw new Error("Invalid user.");
    if (!fileUrl) throw new Error("File URL is required.");

    return RequisitionAttachment.create(
      {
        requisition_id: requisitionId,
        action_id: actionId || null,
        attachment_type: attachmentType,
        file_url: fileUrl,
        file_name: fileName,
        mime_type: mimeType,
        uploaded_by_user_id: actorUserId,
        uploaded_by_name: actor?.fullname || actor?.name || null,
      },
      transaction ? { transaction } : undefined,
    );
  }

  async listForIssue({
    employeeId = null,
    search = "",
    cursor = null,
    cursorMode = false,
    limit = 50,
    viewerActor = {},
  }) {
    const safeLimit = normalizeLimit(limit, 50, 500);
    const useCursorMode = Boolean(cursorMode);

    const where = {
      status: { [Op.in]: ["Approved", "PartiallyApproved", "Fulfilling"] },
    };
    const locationWhere = buildLocationScopeWhere(viewerActor || {});
    if (locationWhere) {
      Object.assign(where, locationWhere);
    }
    if (employeeId !== null && employeeId !== undefined && String(employeeId) !== "") {
      where.requester_emp_id = String(employeeId);
    }

    const q = String(search || "").trim();
    if (q) {
      const like = `%${q}%`;
      where[Op.or] = [
        { req_no: { [Op.like]: like } },
        { requester_name: { [Op.like]: like } },
        { requester_emp_id: { [Op.like]: like } },
        { purpose: { [Op.like]: like } },
      ];
    }

    const baseQuery = {
      where,
      include: [
        {
          model: RequisitionItem,
          as: "items",
          required: false,
          attributes: [
            "id",
            "item_no",
            "particulars",
            "stock_id",
            "item_category_id",
            "sku_unit",
            "requested_qty",
            "approved_qty",
            "issued_qty",
            "item_status",
            "remarks",
          ],
          include: [
            {
              model: ItemCategory,
              as: "itemCategory",
              required: false,
              attributes: ["id", "category_name"],
            },
            {
              model: Stock,
              as: "stock",
              required: false,
              attributes: ["id", "item_name", "quantity", "sku_unit"],
            },
          ],
        },
      ],
      order: [
        ["updatedAt", "DESC"],
        ["id", "DESC"],
      ],
      distinct: true,
    };

    let rows = [];
    let hasMore = false;
    let nextCursor = null;

    if (useCursorMode) {
      const cursorParts = decodeCursor(cursor);
      const cursorWhere = applyDateIdDescCursor(where, cursorParts, "updatedAt", "id");
      const fetched = await Requisition.findAll({
        ...baseQuery,
        where: cursorWhere,
        limit: safeLimit + 1,
      });
      hasMore = fetched.length > safeLimit;
      rows = hasMore ? fetched.slice(0, safeLimit) : fetched;
      nextCursor =
        hasMore && rows.length
          ? encodeCursor({
              updatedAt:
                rows[rows.length - 1].updatedAt instanceof Date
                  ? rows[rows.length - 1].updatedAt.toISOString()
                  : new Date(rows[rows.length - 1].updatedAt).toISOString(),
              id: rows[rows.length - 1].id,
            })
          : null;
    } else {
      rows = await Requisition.findAll({
        ...baseQuery,
        limit: safeLimit,
      });
      hasMore = false;
      nextCursor = null;
    }

    const mapped = rows
      .map((row) => this._mapDetail(row))
      .map((row) => ({
        ...row,
        items: row.items.filter((item) => {
          const remaining = Math.max(0, toQty(item.approved_qty) - toQty(item.issued_qty));
          return remaining > 0 && !["Rejected", "Cancelled"].includes(item.item_status);
        }),
      }))
      .filter((row) => row.items.length > 0);

    return {
      rows: mapped,
      meta: {
        limit: safeLimit,
        hasMore,
        nextCursor,
        mode: useCursorMode ? "cursor" : "offset",
      },
    };
  }

  async applyFulfillment({
    requisitionId,
    actor = {},
    itemConsumptions = [],
    transaction,
  }) {
    if (!transaction) {
      throw new Error("Transaction is required for fulfillment update.");
    }
    const actorUserId = toNumber(actor?.id) || null;
    if (!requisitionId) return null;

    const requisition = await Requisition.findByPk(requisitionId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!requisition) throw new Error("Linked requisition not found.");
    assertActorCanAccessLocation(
      actor || {},
      requisition.location_scope,
      "fulfill this requisition",
    );

    if (!["Approved", "PartiallyApproved", "Fulfilling", "Fulfilled"].includes(requisition.status)) {
      throw new Error("Linked requisition is not in fulfillable status.");
    }

    const items = await RequisitionItem.findAll({
      where: { requisition_id: requisition.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const itemMap = new Map(items.map((item) => [Number(item.id), item]));

    for (const itemConsumption of itemConsumptions || []) {
      const requisitionItemId = toNumber(itemConsumption?.requisition_item_id);
      const issuedQty = toQty(itemConsumption?.issued_qty);
      if (!requisitionItemId || issuedQty <= 0) continue;

      const item = itemMap.get(requisitionItemId);
      if (!item) {
        throw new Error(`Requisition item ${requisitionItemId} not found in requisition.`);
      }

      const approvedQty = toQty(item.approved_qty);
      const currentIssuedQty = toQty(item.issued_qty);
      const nextIssuedQty = toQty(currentIssuedQty + issuedQty);

      if (nextIssuedQty - approvedQty > 0.0001) {
        throw new Error(
          `Issued quantity exceeds approved quantity for item ${requisitionItemId}.`,
        );
      }

      const requestedQty = toQty(item.requested_qty);
      let nextStatus = item.item_status;
      if (approvedQty <= 0) {
        nextStatus = "Rejected";
      } else if (nextIssuedQty >= approvedQty - 0.0001) {
        nextStatus = "Fulfilled";
      } else if (approvedQty < requestedQty) {
        nextStatus = "PartiallyApproved";
      } else {
        nextStatus = "Approved";
      }

      await item.update(
        {
          issued_qty: nextIssuedQty,
          item_status: nextStatus,
        },
        { transaction },
      );
    }

    const refreshedItems = await RequisitionItem.findAll({
      where: { requisition_id: requisition.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const relevant = refreshedItems.filter(
      (item) => toQty(item.approved_qty) > 0 && item.item_status !== "Cancelled",
    );
    const isFullyFulfilled =
      relevant.length > 0 &&
      relevant.every((item) => toQty(item.issued_qty) >= toQty(item.approved_qty) - 0.0001);

    await requisition.update(
      {
        status: isFullyFulfilled ? "Fulfilled" : "Fulfilling",
      },
      { transaction },
    );

    await RequisitionAction.create(
      {
        requisition_id: requisition.id,
        requisition_item_id: null,
        stage_order: requisition.current_stage_order,
        stage_role: requisition.current_stage_role,
        acted_by_user_id: actorUserId || 0,
        acted_by_name: actor?.fullname || actor?.name || "Store",
        acted_by_role: "STORE_ENTRY",
        action: "Fulfill",
        remarks: null,
        payload_json: {
          item_count: itemConsumptions.length,
          status: isFullyFulfilled ? "Fulfilled" : "Fulfilling",
        },
        action_at: new Date(),
      },
      { transaction },
    );

    return requisition.id;
  }
}

module.exports = RequisitionRepository;
