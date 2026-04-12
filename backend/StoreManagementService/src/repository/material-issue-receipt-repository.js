"use strict";

const { Op } = require("sequelize");
const {
  MaterialIssueReceipt,
  Requisition,
  RequisitionItem,
  IssuedItem,
  ItemCategory,
  Stock,
  AssetEvent,
  Asset,
  Employee,
  sequelize,
} = require("../models");
const {
  decodeCursor,
  encodeCursor,
  normalizeLimit,
  applyDateIdDescCursor,
} = require("../utils/cursor-pagination");
const {
  buildLocationScopeWhere,
  assertActorCanAccessLocation,
} = require("../utils/location-scope");
const {
  formatDivisionDisplayLabel,
  normalizeDivisionValue,
} = require("../utils/division-utils");
const {
  resolveMirSignatoryInAuthService,
} = require("../utils/auth-mir-signatory-api");

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toQty = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeText = (value) => {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text || "";
};

const uniqueStrings = (values = []) =>
  [...new Set(values.map(normalizeText).filter(Boolean))];

const buildError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

class MaterialIssueReceiptRepository {
  _buildMirNo(requisition) {
    const reqNo = normalizeText(requisition?.req_no || "");
    if (!reqNo) {
      return `MIR-${requisition?.id || Date.now()}`;
    }
    return `MIR-${reqNo}`.slice(0, 80);
  }

  async _resolveSignatorySnapshot(resolvedCustodian, requisition, options = {}) {
    const receiverType = String(resolvedCustodian?.type || "").trim().toUpperCase();

    if (receiverType === "EMPLOYEE") {
      const employee =
        (resolvedCustodian?.employeeId &&
          (await Employee.findByPk(resolvedCustodian.employeeId, {
            transaction: options.transaction,
          }))) ||
        null;
      const receiverDivision = normalizeText(
        employee?.division || requisition?.requester_division || "",
      );

      return {
        receiver_type: "EMPLOYEE",
        receiver_ref_id: String(
          resolvedCustodian?.employeeId || resolvedCustodian?.id || requisition?.requester_emp_id || "",
        ),
        receiver_name:
          normalizeText(employee?.name) ||
          normalizeText(requisition?.requester_name) ||
          normalizeText(resolvedCustodian?.display_name) ||
          "Employee",
        receiver_designation: normalizeText(employee?.designation) || null,
        receiver_division: receiverDivision || null,
        signatory_role: "EMPLOYEE_RECEIVER",
        signatory_scope_key: null,
        signatory_user_id: toNumber(requisition?.requester_user_id),
        signatory_empcode:
          normalizeText(requisition?.requester_emp_id) ||
          normalizeText(employee?.emp_id) ||
          null,
        signatory_name:
          normalizeText(employee?.name) ||
          normalizeText(requisition?.requester_name) ||
          normalizeText(resolvedCustodian?.display_name) ||
          null,
        signatory_designation: normalizeText(employee?.designation) || null,
        signatory_division: receiverDivision || null,
      };
    }

    const assignmentType =
      receiverType === "DIVISION" ? "DIVISION_HEAD" : "VEHICLE_DRIVER";
    const receiverDivisionValue =
      receiverType === "DIVISION"
        ? normalizeDivisionValue(
            resolvedCustodian?.display_name || requisition?.requester_division || "",
          ) || null
        : null;

    let primaryHolder = null;
    try {
      const resolved = await resolveMirSignatoryInAuthService(
        {
          assignmentType,
          scopeType: "CUSTODIAN",
          scopeKey: String(resolvedCustodian?.id || ""),
        },
        {
          serviceName: options?.serviceName || null,
          requestId: options?.requestId || null,
        },
      );
      primaryHolder = resolved?.primaryHolder || null;
    } catch (error) {
      console.error("MIR signatory resolution fallback:", error?.message || error);
    }

    return {
      receiver_type: receiverType,
      receiver_ref_id: String(resolvedCustodian?.id || ""),
      receiver_name:
        receiverType === "DIVISION"
          ? formatDivisionDisplayLabel(receiverDivisionValue) ||
            normalizeText(resolvedCustodian?.display_name) ||
            String(resolvedCustodian?.id || "")
          : normalizeText(resolvedCustodian?.display_name) ||
            String(resolvedCustodian?.id || ""),
      receiver_designation: null,
      receiver_division: receiverDivisionValue || null,
      signatory_role: assignmentType,
      signatory_scope_key: String(resolvedCustodian?.id || ""),
      signatory_user_id: toNumber(primaryHolder?.id),
      signatory_empcode: normalizeText(primaryHolder?.empcode) || null,
      signatory_name: normalizeText(primaryHolder?.fullname) || null,
      signatory_designation: normalizeText(primaryHolder?.designation) || null,
      signatory_division:
        normalizeText(primaryHolder?.division) ||
        (receiverType === "DIVISION" ? receiverDivisionValue : "") ||
        null,
    };
  }

  _mapListRow(row) {
    const plain = row?.get ? row.get({ plain: true }) : row;
    return {
      id: plain?.id,
      mir_no: plain?.mir_no,
      requisition_id: plain?.requisition_id,
      requisition_req_no:
        plain?.requisition?.req_no || plain?.requisition_req_no || null,
      requester_name: plain?.requisition?.requester_name || null,
      requester_division: plain?.requisition?.requester_division || null,
      purpose: plain?.requisition?.purpose || null,
      receiver_type: plain?.receiver_type,
      receiver_name: plain?.receiver_name,
      receiver_designation: plain?.receiver_designation || null,
      receiver_division: plain?.receiver_division || null,
      signatory_role: plain?.signatory_role || null,
      signatory_name: plain?.signatory_name || null,
      signatory_designation: plain?.signatory_designation || null,
      signatory_division: plain?.signatory_division || null,
      location_scope: plain?.location_scope || null,
      issued_at: plain?.issued_at || plain?.createdAt || null,
      status: plain?.status,
      signed_mir_url: plain?.signed_mir_url || null,
      uploaded_at: plain?.uploaded_at || null,
      uploaded_by_name: plain?.uploaded_by_name || null,
      createdAt: plain?.createdAt || null,
      updatedAt: plain?.updatedAt || null,
    };
  }

  async createOrUpdateForOnlineRequisition({
    requisition,
    resolvedCustodian,
    actor = {},
    transaction,
  }) {
    if (!transaction) {
      throw buildError("Transaction is required for MIR creation.", 500);
    }
    if (!requisition?.id) return null;

    const snapshot = await this._resolveSignatorySnapshot(
      resolvedCustodian,
      requisition,
      {
        transaction,
        serviceName: actor?.serviceName || null,
        requestId: actor?.requestId || null,
      },
    );
    const issuedAt = new Date();
    const payload = {
      mir_no: this._buildMirNo(requisition),
      requisition_id: requisition.id,
      requisition_req_no: requisition.req_no,
      location_scope: requisition.location_scope || null,
      issued_at: issuedAt,
      ...snapshot,
    };

    const existing = await MaterialIssueReceipt.findOne({
      where: { requisition_id: requisition.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (existing) {
      await existing.update(
        {
          ...payload,
          // If the MIR is regenerated for the same requisition, any older
          // signed upload is no longer trustworthy for the latest issue state.
          status: "PENDING_SIGNATURE",
          signed_mir_url: null,
          uploaded_at: null,
          uploaded_by_user_id: null,
          uploaded_by_name: null,
          printed_at: null,
        },
        { transaction },
      );
      return existing.get({ plain: true });
    }

    const created = await MaterialIssueReceipt.create(payload, { transaction });
    return created.get({ plain: true });
  }

  async list({
    page = 1,
    limit = 50,
    cursor = null,
    cursorMode = false,
    status = "",
    search = "",
    fromDate = "",
    toDate = "",
    viewerActor = {},
  }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = normalizeLimit(limit, 50, 500);
    const useCursorMode = Boolean(cursorMode);
    const offset = (safePage - 1) * safeLimit;

    const where = {};
    const locationWhere = buildLocationScopeWhere(viewerActor || {});
    if (locationWhere) {
      Object.assign(where, locationWhere);
    }

    if (status) {
      where.status = String(status).trim().toUpperCase();
    }

    if (fromDate || toDate) {
      where.issued_at = {};
      if (fromDate) where.issued_at[Op.gte] = new Date(`${fromDate}T00:00:00.000`);
      if (toDate) where.issued_at[Op.lte] = new Date(`${toDate}T23:59:59.999`);
    }

    const q = normalizeText(search);
    if (q) {
      const like = `%${q}%`;
      where[Op.or] = [
        { mir_no: { [Op.like]: like } },
        { requisition_req_no: { [Op.like]: like } },
        { receiver_name: { [Op.like]: like } },
        { signatory_name: { [Op.like]: like } },
        { "$requisition.requester_name$": { [Op.like]: like } },
        { "$requisition.requester_division$": { [Op.like]: like } },
      ];
    }

    const baseQuery = {
      distinct: true,
      subQuery: false,
      include: [
        {
          model: Requisition,
          as: "requisition",
          required: false,
          attributes: [
            "id",
            "req_no",
            "requester_name",
            "requester_division",
            "purpose",
            "status",
          ],
        },
      ],
      order: [
        ["issued_at", "DESC"],
        ["id", "DESC"],
      ],
    };

    if (useCursorMode) {
      const cursorParts = decodeCursor(cursor);
      const cursorWhere = applyDateIdDescCursor(where, cursorParts, "issued_at", "id");
      const rowsWithExtra = await MaterialIssueReceipt.findAll({
        ...baseQuery,
        where: cursorWhere,
        limit: safeLimit + 1,
      });
      const hasMore = rowsWithExtra.length > safeLimit;
      const rows = hasMore ? rowsWithExtra.slice(0, safeLimit) : rowsWithExtra;
      const nextCursor =
        hasMore && rows.length
          ? encodeCursor({
              issued_at:
                rows[rows.length - 1].issued_at instanceof Date
                  ? rows[rows.length - 1].issued_at.toISOString()
                  : new Date(rows[rows.length - 1].issued_at).toISOString(),
              id: rows[rows.length - 1].id,
            })
          : null;

      return {
        rows: rows.map((row) => this._mapListRow(row)),
        meta: {
          limit: safeLimit,
          hasMore,
          nextCursor,
          mode: "cursor",
        },
      };
    }

    const { rows, count } = await MaterialIssueReceipt.findAndCountAll({
      ...baseQuery,
      where,
      limit: safeLimit,
      offset,
    });

    return {
      rows: rows.map((row) => this._mapListRow(row)),
      meta: {
        page: safePage,
        limit: safeLimit,
        total: count,
        totalPages: Math.max(1, Math.ceil(Number(count || 0) / safeLimit)),
        mode: "offset",
      },
    };
  }

  async getById(mirId, actor = {}, options = {}) {
    const mir = await MaterialIssueReceipt.findByPk(mirId, {
      transaction: options.transaction || undefined,
      include: [
        {
          model: Requisition,
          as: "requisition",
          attributes: [
            "id",
            "req_no",
            "requester_user_id",
            "requester_emp_id",
            "requester_name",
            "requester_division",
            "location_scope",
            "purpose",
            "status",
            "submitted_at",
            "final_approved_at",
            "createdAt",
            "updatedAt",
          ],
          include: [
            {
              model: RequisitionItem,
              as: "items",
              required: false,
              attributes: [
                "id",
                "item_no",
                "particulars",
                "requested_qty",
                "approved_qty",
                "issued_qty",
                "sku_unit",
                "item_status",
                "stock_id",
              ],
              include: [
                {
                  model: ItemCategory,
                  as: "itemCategory",
                  required: false,
                  attributes: ["id", "category_name", "serialized_required"],
                },
                {
                  model: Stock,
                  as: "stock",
                  required: false,
                  attributes: ["id", "item_name"],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!mir) return null;

    assertActorCanAccessLocation(
      actor || {},
      mir.location_scope,
      "access this MIR",
    );

    const issuedRows = await IssuedItem.findAll({
      where: { requisition_id: mir.requisition_id },
      transaction: options.transaction || undefined,
      include: [
        {
          model: AssetEvent,
          required: false,
          where: { event_type: "Issued" },
          include: [
            {
              model: Asset,
              required: false,
              attributes: ["id", "asset_tag", "serial_number"],
            },
          ],
        },
      ],
      order: [
        ["date", "ASC"],
        ["id", "ASC"],
      ],
    });

    const issuedByItemId = new Map();
    for (const row of issuedRows) {
      const plain = row.get({ plain: true });
      const key = toNumber(plain?.requisition_item_id);
      if (!key) continue;
      const current = issuedByItemId.get(key) || {
        quantity: 0,
        assetLabels: [],
        issuedIds: [],
      };
      current.quantity += toQty(plain?.quantity);
      current.issuedIds.push(plain?.id);
      const assetLabels = (plain?.AssetEvents || [])
        .map((event) => {
          const asset = event?.Asset;
          return normalizeText(asset?.serial_number || asset?.asset_tag || asset?.id);
        })
        .filter(Boolean);
      current.assetLabels.push(...assetLabels);
      issuedByItemId.set(key, current);
    }

    const requisition = mir.requisition?.get
      ? mir.requisition.get({ plain: true })
      : mir.requisition || null;
    const items = (requisition?.items || [])
      .map((item) => {
        const key = toNumber(item?.id);
        const issued = issuedByItemId.get(key) || {
          quantity: 0,
          assetLabels: [],
          issuedIds: [],
        };
        const issuedQty = issued.quantity > 0 ? issued.quantity : toQty(item?.issued_qty);
        return {
          requisition_item_id: item.id,
          item_no: item.item_no,
          particulars:
            item.particulars ||
            item.stock?.item_name ||
            item.itemCategory?.category_name ||
            "Item",
          category_name: item.itemCategory?.category_name || null,
          requested_qty: toQty(item.requested_qty),
          approved_qty: toQty(item.approved_qty),
          issued_qty: issuedQty,
          sku_unit: item.sku_unit || "Unit",
          item_status: item.item_status,
          serialized: Boolean(item.itemCategory?.serialized_required),
          asset_labels: uniqueStrings(issued.assetLabels),
          issued_ids: issued.issuedIds,
        };
      })
      .filter((item) => item.issued_qty > 0);

    return {
      id: mir.id,
      mir_no: mir.mir_no,
      status: mir.status,
      issued_at: mir.issued_at,
      printed_at: mir.printed_at || null,
      signed_mir_url: mir.signed_mir_url || null,
      uploaded_at: mir.uploaded_at || null,
      uploaded_by_user_id: mir.uploaded_by_user_id || null,
      uploaded_by_name: mir.uploaded_by_name || null,
      location_scope: mir.location_scope || null,
      receiver: {
        type: mir.receiver_type,
        ref_id: mir.receiver_ref_id,
        name: mir.receiver_name,
        designation: mir.receiver_designation || null,
        division: mir.receiver_division || null,
      },
      signatory: {
        role: mir.signatory_role || null,
        scope_key: mir.signatory_scope_key || null,
        user_id: mir.signatory_user_id || null,
        empcode: mir.signatory_empcode || null,
        name: mir.signatory_name || null,
        designation: mir.signatory_designation || null,
        division: mir.signatory_division || null,
      },
      requisition: {
        id: requisition?.id || mir.requisition_id,
        req_no: requisition?.req_no || mir.requisition_req_no,
        requester_user_id: requisition?.requester_user_id || null,
        requester_emp_id: requisition?.requester_emp_id || null,
        requester_name: requisition?.requester_name || null,
        requester_division: requisition?.requester_division || null,
        purpose: requisition?.purpose || null,
        status: requisition?.status || null,
        submitted_at: requisition?.submitted_at || null,
        final_approved_at: requisition?.final_approved_at || null,
      },
      items,
      totals: {
        line_count: items.length,
        total_issued_qty: items.reduce((sum, item) => sum + toQty(item.issued_qty), 0),
        serialized_asset_count: items.reduce(
          (sum, item) => sum + (Array.isArray(item.asset_labels) ? item.asset_labels.length : 0),
          0,
        ),
      },
    };
  }

  async uploadSigned({ mirId, fileUrl, actor = {} }) {
    if (!fileUrl) {
      throw buildError("Signed MIR file is required.");
    }

    return sequelize.transaction(async (transaction) => {
      const mir = await MaterialIssueReceipt.findByPk(mirId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!mir) {
        throw buildError("MIR not found.", 404);
      }

      assertActorCanAccessLocation(
        actor || {},
        mir.location_scope,
        "upload signed MIR for this location",
      );

      await mir.update(
        {
          signed_mir_url: fileUrl,
          status: "SIGNED_UPLOADED",
          uploaded_at: new Date(),
          uploaded_by_user_id: toNumber(actor?.id),
          uploaded_by_name:
            normalizeText(actor?.fullname || actor?.name || "") || "Store",
        },
        { transaction },
      );

      return this.getById(mir.id, actor, { transaction });
    });
  }
}

module.exports = MaterialIssueReceiptRepository;
