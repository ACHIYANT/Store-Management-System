// repository/asset-repository.js
const {
  sequelize,
  Asset,
  AssetEvent,
  DayBook,
  DayBookItem,
  DayBookItemSerial,
  Stock,
  ItemMaster,
  ItemCategory,
  ItemCategoryGroup,
  ItemCategoryHead,
  Employee,
  Custodian,
  Vendors,
  GatePassItem,
} = require("../models");
const { Op } = require("sequelize");
const GatePassRepository = require("./gatepass-repository");
const {
  decodeCursor,
  encodeCursor,
  normalizeLimit,
  applyDateIdDescCursor,
  applyIdDescCursor,
} = require("../utils/cursor-pagination");
const { logStockMovement } = require("../services/stock-movement-service");
const {
  normalizeCustodianInput,
  ensureCustodian,
  toCustodianFields,
} = require("../utils/custodian-utils");
const {
  assertActorCanAccessLocation,
  buildLocationScopeWhere,
  getLocationScopeFromResolvedCustodian,
  normalizeLocationScope,
} = require("../utils/location-scope");
const {
  generateAssetSecurityCode,
} = require("../utils/asset-security-code");

const buildHolderSummary = (asset = {}) => {
  if (asset?.Employee) {
    return {
      type: "EMPLOYEE",
      id: asset.Employee.emp_id ?? asset.current_employee_id ?? null,
      name: asset.Employee.name ?? null,
      division: asset.Employee.division ?? null,
      location:
        asset.Employee.office_location ?? asset.location_scope ?? null,
    };
  }

  if (asset?.Custodian) {
    return {
      type: asset.Custodian.custodian_type ?? asset.custodian_type ?? "CUSTODIAN",
      id: asset.Custodian.id ?? asset.custodian_id ?? null,
      name: asset.Custodian.display_name ?? null,
      division: null,
      location: asset.Custodian.location ?? asset.location_scope ?? null,
    };
  }

  return null;
};

const resolveCustodian = async (
  { employeeId, custodianId, custodianType },
  transaction,
  { required = false } = {},
) => {
  const normalized = normalizeCustodianInput({
    employeeId,
    custodianId,
    custodianType,
  });
  if (!normalized) {
    if (required) {
      throw new Error("custodian is required");
    }
    return null;
  }
  return ensureCustodian(normalized, { transaction });
};

const ensureSameLocationScope = (
  sourceLocationScope,
  targetLocationScope,
  label,
) => {
  const source = normalizeLocationScope(sourceLocationScope);
  const target = normalizeLocationScope(targetLocationScope);

  if (!source || !target) {
    throw new Error(
      `${label} is missing location information. Please backfill the location before continuing.`,
    );
  }

  if (source !== target) {
    throw new Error(`${label} must belong to the same location.`);
  }

  return source;
};

/**
 * Fields referenced exist per your migrations for Assets and AssetEvents.
 * - Assets: serial_number, status, purchased_at, warranty_expiry, asset_tag,
 *           stock_id, item_category_id, daybook_id, daybook_item_id,
 *           vendor_id, current_employee_id
 * - AssetEvents: asset_id, event_type, event_date, daybook_id, daybook_item_id,
 *                issued_item_id, from_employee_id, to_employee_id, notes
 * Migrations: create-assets, create-asset-events.
 */

class AssetRepository {
  async _applyStockDelta(deltaByStockId, t, movementMeta = null) {
    const ids = Object.keys(deltaByStockId).map(Number).filter(Boolean);
    const locationScopeByStock = movementMeta?.locationScopeByStock || {};
    for (const stockId of ids) {
      const delta = Number(deltaByStockId[stockId]) || 0;
      if (!delta) continue;
      // const row = await Stock.findByPk(stockId, {
      //   transaction: t,
      //   lock: t.LOCK.UPDATE,
      // });
      const row = await Stock.findOne({
        where: { id: stockId, is_active: true },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!row) continue; // or throw if you prefer strictness
      await row.update(
        { quantity: (row.quantity || 0) + delta },
        { transaction: t },
      );

      if (movementMeta?.movementType) {
        const metadataByStock = movementMeta?.metadataByStock || {};
        await logStockMovement(
          {
            itemMasterId: row.item_master_id || null,
            stockId: row.id,
            movementType: movementMeta.movementType,
            qty: delta,
            skuUnit: row.sku_unit || "Unit",
            movementAt: movementMeta.movementAt || new Date(),
            referenceType: movementMeta.referenceType || null,
            referenceId: movementMeta.referenceId || null,
            fromEmployeeId: movementMeta.fromEmployeeId || null,
            toEmployeeId: movementMeta.toEmployeeId || null,
            performedBy: movementMeta.performedBy || null,
            remarks: movementMeta.remarks || null,
            locationScope:
              locationScopeByStock[String(stockId)] ||
              movementMeta.locationScope ||
              null,
            metadata: metadataByStock[String(stockId)] || movementMeta.metadata || null,
          },
          { transaction: t },
        );
      }
    }
  }
  /**
   * On approved DayBook, migrate all staged serials (migrated_at = null)
   * into Assets and emit "Created" events. DayBookItems and DayBook schema exist.
   */
  async migrateSerialsToAssets(daybookId, transaction, actor = null) {
    const t = transaction;
    // const t = await sequelize.transaction();
    if (!t) {
      throw new Error("Transaction is required for migrateSerialsToAssets");
    }
    const db = await DayBook.findByPk(daybookId, { transaction: t });
    if (!db) throw new Error("DayBook not found");
    if (actor) {
      assertActorCanAccessLocation(
        actor,
        db.location_scope,
        "finalize approved daybooks for this location",
      );
    }
    // if (db.approval_level !== 3) throw new Error("DayBook not approved");
    if (db.status !== "Approved") throw new Error("DayBook not approved");

    const items = await DayBookItem.findAll({
      where: { daybook_id: daybookId },
      transaction: t,
    });

    const created = [];
    for (const it of items) {
      const serials = await DayBookItemSerial.findAll({
        where: { daybook_item_id: it.id, migrated_at: null },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      for (const s of serials) {
        const a = await Asset.create(
          {
            serial_number: s.serial_number,
            status: "InStore",
            purchased_at: s.purchased_at,
            warranty_expiry: s.warranty_expiry,
            asset_tag: s.asset_tag || null,
            stock_id: it.stock_id || null,
            item_category_id: it.item_category_id,
            daybook_id: it.daybook_id,
            daybook_item_id: it.id,
            vendor_id: db.vendor_id || null,
            current_employee_id: null,
            ...toCustodianFields(null),
            location_scope: db.location_scope || null,
          },
          { transaction: t },
        );

        await AssetEvent.create(
          {
            asset_id: a.id,
            event_type: "Created",
            event_date: db.bill_date || new Date(),
            daybook_id: db.id,
            daybook_item_id: it.id,
            location_scope: db.location_scope || null,
            notes: "Created from approved DayBook",
          },
          { transaction: t },
        );

        await s.update({ migrated_at: new Date() }, { transaction: t });
        created.push(a.get({ plain: true }));
      }
    }

    return created;
  }

  /** List assets ready to issue for a stock item (status=InStore). */
  async getInStoreByStock(
    stockId,
    { search = "", limit = null, cursor = null, cursorMode = false } = {},
    actor = null,
  ) {
    const where = {
      stock_id: stockId,
      status: "InStore",
      is_active: true,
    };

    const searchTerm = String(search || "").trim();
    if (searchTerm) {
      const like = `%${searchTerm}%`;
      where[Op.or] = [
        { asset_tag: { [Op.like]: like } },
        { serial_number: { [Op.like]: like } },
      ];
    }

    const locationWhere = buildLocationScopeWhere(actor || {});
    if (locationWhere) {
      Object.assign(where, locationWhere);
    }

    const order = [["id", "DESC"]];
    const useCursorMode = Boolean(cursorMode) && limit != null;

    if (!useCursorMode) {
      return Asset.findAll({ where, order });
    }

    const safeLimit = normalizeLimit(limit, 100, 500);
    const cursorParts = decodeCursor(cursor);
    const cursorWhere = applyIdDescCursor(where, cursorParts, "id");
    const rowsWithExtra = await Asset.findAll({
      where: cursorWhere,
      order,
      limit: safeLimit + 1,
    });

    const hasMore = rowsWithExtra.length > safeLimit;
    const rows = hasMore ? rowsWithExtra.slice(0, safeLimit) : rowsWithExtra;
    const nextCursor =
      hasMore && rows.length
        ? encodeCursor({ id: rows[rows.length - 1].id })
        : null;

    return {
      rows,
      meta: {
        limit: safeLimit,
        hasMore,
        nextCursor,
        mode: "cursor",
      },
    };
  }

  /** List assets currently with an employee. */
  async getByEmployee(employeeId, actor = null) {
    const where = {
      current_employee_id: employeeId,
      status: {
        [Op.in]: ["Issued", "Repair"],
      },
      is_active: true,
    };
    const locationWhere = buildLocationScopeWhere(actor || {});
    if (locationWhere) {
      Object.assign(where, locationWhere);
    }

    return Asset.findAll({
      where,
      include: [
        {
          model: ItemCategory,
          attributes: ["id", "category_name"],
          required: false,
        },
      ],
      order: [["id", "ASC"]],
    });
  }
  async getAll(actor = null) {
    const where = { is_active: true };
    const locationWhere = buildLocationScopeWhere(actor || {});
    if (locationWhere) {
      Object.assign(where, locationWhere);
    }
    return await Asset.findAll({
      where,
      order: [["id", "DESC"]],
    });
  }

  async getVerificationSummaryById(assetId) {
    const assetIdNum = Number(assetId);
    if (!Number.isFinite(assetIdNum) || assetIdNum <= 0) return null;

    const asset = await Asset.findByPk(assetIdNum, {
      include: [
        {
          model: Stock,
          attributes: ["id", "item_name"],
          required: false,
        },
        {
          model: ItemMaster,
          as: "itemMaster",
          attributes: ["id", "display_name"],
          required: false,
        },
        {
          model: ItemCategory,
          attributes: ["id", "category_name"],
          required: false,
        },
        {
          model: DayBook,
          attributes: ["id", "entry_no"],
          required: false,
        },
        {
          model: Vendors,
          attributes: ["id", "name"],
          required: false,
        },
        {
          model: Employee,
          attributes: ["emp_id", "name", "division", "office_location"],
          required: false,
        },
        {
          model: Custodian,
          attributes: ["id", "custodian_type", "display_name", "location"],
          required: false,
        },
      ],
    });

    if (!asset) return null;

    const latestEvent = await AssetEvent.findOne({
      where: { asset_id: assetIdNum },
      attributes: ["id", "event_type", "event_date"],
      order: [
        ["event_date", "DESC"],
        ["id", "DESC"],
      ],
    });

    const plain = asset.get({ plain: true });

    return {
      id: plain.id,
      serial_number: plain.serial_number,
      asset_tag: plain.asset_tag,
      status: plain.status,
      location_scope: plain.location_scope,
      purchased_at: plain.purchased_at ?? null,
      warranty_expiry: plain.warranty_expiry ?? null,
      item_name:
        plain.itemMaster?.display_name || plain.Stock?.item_name || null,
      category_name: plain.ItemCategory?.category_name || null,
      vendor_name: plain.Vendor?.name || null,
      daybook_entry_no: plain.DayBook?.entry_no || null,
      current_holder: buildHolderSummary(plain),
      last_event_type: latestEvent?.event_type || null,
      last_event_date: latestEvent?.event_date || null,
      verification_code: generateAssetSecurityCode({
        assetId: plain.id,
        serialNumber: plain.serial_number,
      }),
    };
  }
  /** Return assets to store and log events. */
  async returnAssets({
    assetIds = [],
    fromEmployeeId,
    fromCustodianId,
    fromCustodianType,
    notes,
    approvalDocumentUrl,
    actor = null,
  }) {
    if (!Array.isArray(assetIds) || assetIds.length === 0)
      throw new Error("assetIds[] is required");
    const t = await sequelize.transaction();
    try {
      const fromCustodian = await resolveCustodian(
        {
          employeeId: fromEmployeeId,
          custodianId: fromCustodianId,
          custodianType: fromCustodianType,
        },
        t,
      );

      const assets = await Asset.findAll({
        where: { id: assetIds },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (assets.length !== assetIds.length)
        throw new Error("One or more assets not found");
      // accumulate increments per stock
      const incr = {};
      const locationScopeByStock = {};
      for (const a of assets) {
        const assetLocationScope = assertActorCanAccessLocation(
          actor || {},
          a.location_scope,
          "return assets from this location",
        );
        const inferredFromCustodian =
          fromCustodian ||
          normalizeCustodianInput({
            employeeId: a.current_employee_id,
            custodianId: a.custodian_id,
            custodianType: a.custodian_type,
          });

        await a.update(
          { status: "InStore", current_employee_id: null, ...toCustodianFields(null) },
          { transaction: t },
        );
        await AssetEvent.create(
          {
            asset_id: a.id,
            event_type: "Returned",
            event_date: new Date(),
            from_employee_id:
              inferredFromCustodian?.employeeId ?? a.current_employee_id ?? null,
            from_custodian_id:
              inferredFromCustodian?.id ??
              (a.current_employee_id != null ? String(a.current_employee_id) : null),
            from_custodian_type:
              inferredFromCustodian?.type ??
              (a.current_employee_id != null ? "EMPLOYEE" : null),
            ...toCustodianFields(inferredFromCustodian),
            location_scope: assetLocationScope,
            notes: notes || null,
            approval_document_url: approvalDocumentUrl || null,
          },
          { transaction: t },
        );
        if (a.stock_id) {
          incr[a.stock_id] = (incr[a.stock_id] || 0) + 1;
          locationScopeByStock[String(a.stock_id)] = assetLocationScope;
        }
      }
      // reflect back in Stock.quantity
      await this._applyStockDelta(incr, t, {
        movementType: "RETURN_IN",
        referenceType: "AssetEvent",
        movementAt: new Date(),
        fromEmployeeId: fromEmployeeId || null,
        performedBy: "Asset Return",
        remarks: notes || "Asset returned to store",
        locationScopeByStock,
      });
      await t.commit();
      return { affected: assets.length };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /** Transfer custody between employees and log events. */
  async transferAssets({
    assetIds = [],
    fromEmployeeId,
    toEmployeeId,
    fromCustodianId,
    fromCustodianType,
    toCustodianId,
    toCustodianType,
    notes,
    approvalDocumentUrl,
    actor = null,
  }) {
    if (!Array.isArray(assetIds) || assetIds.length === 0)
      throw new Error("assetIds[] is required");
    const t = await sequelize.transaction();
    try {
      const fromCustodian = await resolveCustodian(
        {
          employeeId: fromEmployeeId,
          custodianId: fromCustodianId,
          custodianType: fromCustodianType,
        },
        t,
      );
      const toCustodian = await resolveCustodian(
        {
          employeeId: toEmployeeId,
          custodianId: toCustodianId,
          custodianType: toCustodianType,
        },
        t,
        { required: true },
      );
      const resolvedToEmployeeId = toCustodian?.employeeId ?? null;
      const toLocationScope = getLocationScopeFromResolvedCustodian(toCustodian);

      const assets = await Asset.findAll({
        where: { id: assetIds, status: "Issued" },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (assets.length !== assetIds.length)
        throw new Error("One or more assets are not in Issued state");

      for (const a of assets) {
        const assetLocationScope = assertActorCanAccessLocation(
          actor || {},
          a.location_scope,
          "transfer assets from this location",
        );
        ensureSameLocationScope(
          assetLocationScope,
          toLocationScope,
          "Transfer target",
        );
        await a.update(
          {
            current_employee_id: resolvedToEmployeeId,
            ...toCustodianFields(toCustodian),
          },
          { transaction: t },
        );
        await AssetEvent.create(
          {
            asset_id: a.id,
            event_type: "Transferred",
            event_date: new Date(),
            from_employee_id: fromCustodian?.employeeId ?? null,
            to_employee_id: resolvedToEmployeeId,
            from_custodian_id: fromCustodian?.id ?? null,
            from_custodian_type: fromCustodian?.type ?? null,
            to_custodian_id: toCustodian?.id ?? null,
            to_custodian_type: toCustodian?.type ?? null,
            ...toCustodianFields(toCustodian),
            location_scope: assetLocationScope,
            notes: notes || null,
            approval_document_url: approvalDocumentUrl || null,
          },
          { transaction: t },
        );
      }

      await t.commit();
      return { affected: assets.length };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /** Send assets to repair and log events. */
  async repairOut({
    assetIds = [],
    notes,
    createdBy,
    approvalDocumentUrl,
    actor = null,
  }) {
    if (!Array.isArray(assetIds) || assetIds.length === 0)
      throw new Error("assetIds[] is required");

    const t = await sequelize.transaction();
    try {
      const assets = await Asset.findAll({
        where: { id: assetIds },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (assets.length !== assetIds.length)
        throw new Error("One or more assets not found");
      const allowedForRepairOut = new Set(["InStore", "Issued"]);
      const invalidForRepairOut = assets.filter(
        (a) => !allowedForRepairOut.has(String(a.status)),
      );
      if (invalidForRepairOut.length) {
        const list = invalidForRepairOut
          .map((a) => `#${a.id}:${a.status || "Unknown"}`)
          .join(", ");
        throw new Error(
          `Repair Out is allowed only for InStore/Issued assets. Invalid: ${list}`,
        );
      }
      const decr = {};
      const locationScopeByStock = {};
      for (const a of assets) {
        const assetLocationScope = assertActorCanAccessLocation(
          actor || {},
          a.location_scope,
          "send assets to repair from this location",
        );
        const wasInStore = a.status === "InStore"; // capture BEFORE update
        const updatePayload = { status: "Repair" };
        if (wasInStore) {
          updatePayload.current_employee_id = null;
          Object.assign(updatePayload, toCustodianFields(null));
        }
        await a.update(updatePayload, { transaction: t });
        await AssetEvent.create(
          {
            asset_id: a.id,
            event_type: "RepairOut",
            event_date: new Date(),
            location_scope: assetLocationScope,
            notes: notes || null,
            approval_document_url: approvalDocumentUrl || null,
          },
          { transaction: t },
        );
        if (wasInStore && a.stock_id) {
          // only decrement if it was previously available in store
          decr[a.stock_id] = (decr[a.stock_id] || 0) - 1;
          locationScopeByStock[String(a.stock_id)] = assetLocationScope;
        }
      }

      await this._applyStockDelta(decr, t, {
        movementType: "REPAIR_OUT",
        referenceType: "AssetEvent",
        movementAt: new Date(),
        performedBy: createdBy?.name || createdBy?.fullname || "Asset Repair",
        remarks: notes || "Asset moved to repair",
        locationScopeByStock,
      });
      const gatePassRepo = new GatePassRepository();
      const gatePass = await gatePassRepo.createRepairOutPass({
        assets,
        notes,
        createdBy,
        actor,
        transaction: t,
      });

      await t.commit();
      return { affected: assets.length, gatePass };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /** Receive assets back from repair and log events. */
  async repairIn({ assetIds = [], notes, actor = null }) {
    if (!Array.isArray(assetIds) || assetIds.length === 0)
      throw new Error("assetIds[] is required");

    const t = await sequelize.transaction();
    try {
      const normalizedAssetIds = [
        ...new Set(assetIds.map(Number).filter(Number.isFinite)),
      ];
      if (!normalizedAssetIds.length) throw new Error("Valid assetIds[] required");

      // Enforce gate verification by checking the latest gate-pass item per asset.
      const gatePassItems = await GatePassItem.findAll({
        where: { asset_id: normalizedAssetIds },
        order: [["id", "DESC"]],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const latestByAsset = new Map();
      for (const row of gatePassItems) {
        if (!latestByAsset.has(row.asset_id)) {
          latestByAsset.set(row.asset_id, row);
        }
      }

      if (latestByAsset.size !== normalizedAssetIds.length) {
        throw new Error(
          "Gate pass not found for one or more assets. Repair-in requires a gate pass cycle.",
        );
      }

      for (const assetId of normalizedAssetIds) {
        const gpItem = latestByAsset.get(assetId);
        if (!gpItem?.out_verified_at) {
          throw new Error(
            `Asset ${assetId} is not verified at gate-out for its latest gate pass.`,
          );
        }
        if (!gpItem?.in_verified_at) {
          throw new Error(
            `Asset ${assetId} must be verified at gate-in before Repair In.`,
          );
        }
      }

      const assets = await Asset.findAll({
        where: { id: normalizedAssetIds, status: "Repair" },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (assets.length !== normalizedAssetIds.length)
        throw new Error("One or more assets are not in Repair state");
      const incr = {};
      const locationScopeByStock = {};
      for (const a of assets) {
        const assetLocationScope = assertActorCanAccessLocation(
          actor || {},
          a.location_scope,
          "receive repaired assets for this location",
        );
        // return to store; custody reassignment can be handled by issue flow
        await a.update(
          {
            status: "InStore",
            current_employee_id: null,
            ...toCustodianFields(null),
          },
          { transaction: t },
        );
        await AssetEvent.create(
          {
            asset_id: a.id,
            event_type: "RepairIn",
            event_date: new Date(),
            location_scope: assetLocationScope,
            notes: notes || null,
          },
          { transaction: t },
        );
        if (a.stock_id) {
          incr[a.stock_id] = (incr[a.stock_id] || 0) + 1;
          locationScopeByStock[String(a.stock_id)] = assetLocationScope;
        }
      }
      await this._applyStockDelta(incr, t, {
        movementType: "REPAIR_IN",
        referenceType: "AssetEvent",
        movementAt: new Date(),
        performedBy: "Asset Repair",
        remarks: notes || "Asset returned from repair",
        locationScopeByStock,
      });
      await t.commit();
      return {
        affected: assets.length,
        verified_gate_pass_items: normalizedAssetIds.map(
          (assetId) => latestByAsset.get(assetId).id,
        ),
      };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /** Dispose or mark lost and log events. */
  async finalize({
    assetIds = [],
    type = "Disposed",
    notes,
    approvalDocumentUrl,
    actor = null,
  }) {
    if (!Array.isArray(assetIds) || assetIds.length === 0)
      throw new Error("assetIds[] is required");
    if (!["Disposed", "Lost", "EWaste"].includes(type))
      throw new Error("type must be 'Disposed', 'Lost' or 'EWaste'");

    const t = await sequelize.transaction();
    try {
      const assets = await Asset.findAll({
        where: { id: assetIds },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (assets.length !== assetIds.length)
        throw new Error("One or more assets not found");
      const blockedFinalizeStatuses = new Set([
        "EWaste",
        "EWasteOut",
        "Disposed",
        "Lost",
        "Retained",
        "Removed as MRN Cancelled",
      ]);
      const invalidForFinalize = assets.filter((a) =>
        blockedFinalizeStatuses.has(String(a.status)),
      );
      if (invalidForFinalize.length) {
        const list = invalidForFinalize
          .map((a) => `#${a.id}:${a.status || "Unknown"}`)
          .join(", ");
        throw new Error(
          `Finalize is not allowed for already final/removed assets. Invalid: ${list}`,
        );
      }

      // Track stock decrements only for assets that were actually InStore
      const decr = {};
      const locationScopeByStock = {};
      for (const a of assets) {
        const assetLocationScope = assertActorCanAccessLocation(
          actor || {},
          a.location_scope,
          "finalize assets for this location",
        );
        const wasInStore = a.status === "InStore"; // capture BEFORE update
        const eventType = type === "EWaste" ? "MarkedEWaste" : type;
        await a.update(
          { status: type, current_employee_id: null, ...toCustodianFields(null) },
          { transaction: t },
        );
        await AssetEvent.create(
          {
            asset_id: a.id,
            event_type: eventType,
            event_date: new Date(),
            location_scope: assetLocationScope,
            notes: notes || null,
            approval_document_url: approvalDocumentUrl || null,
          },
          { transaction: t },
        );
        // Business rule: disposing an InStore asset reduces available stock
        if ((type === "Disposed" || type === "EWaste") && wasInStore && a.stock_id) {
          decr[a.stock_id] = (decr[a.stock_id] || 0) - 1;
          locationScopeByStock[String(a.stock_id)] = assetLocationScope;
        }
        // If you also want "Lost" to reduce stock when lost from store, uncomment:
        // if (type === "Lost" && wasInStore && a.stock_id) {
        //   decr[a.stock_id] = (decr[a.stock_id] || 0) - 1;
        // }
      }
      const finalizeMovementType =
        type === "EWaste"
          ? "EWASTE_OUT"
          : type === "Lost"
            ? "LOST_OUT"
            : "DISPOSE_OUT";

      // Apply pending stock changes (if any)
      await this._applyStockDelta(decr, t, {
        movementType: finalizeMovementType,
        referenceType: "AssetEvent",
        movementAt: new Date(),
        performedBy: "Asset Finalization",
        remarks: notes || `Asset marked as ${type}`,
        locationScopeByStock,
        metadata: {
          finalize_type: type,
        },
      });

      await t.commit();
      return { affected: assets.length };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /** Mark issued assets as retained by employee (retirement policy). */
  async retain({ assetIds = [], notes, approvalDocumentUrl, actor = null }) {
    if (!Array.isArray(assetIds) || assetIds.length === 0)
      throw new Error("assetIds[] is required");

    const t = await sequelize.transaction();
    try {
      const assets = await Asset.findAll({
        where: { id: assetIds },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (assets.length !== assetIds.length)
        throw new Error("One or more assets not found");

      const invalid = assets.filter((a) => String(a.status) !== "Issued");
      if (invalid.length) {
        const list = invalid
          .map((a) => `#${a.id}:${a.status || "Unknown"}`)
          .join(", ");
        throw new Error(
          `Retain is allowed only for Issued assets. Invalid: ${list}`,
        );
      }

      const noCustodian = assets.filter((a) => !a.current_employee_id);
      if (noCustodian.length) {
        const list = noCustodian.map((a) => `#${a.id}`).join(", ");
        throw new Error(`Retain requires an issued employee. Invalid: ${list}`);
      }

      for (const a of assets) {
        const assetLocationScope = assertActorCanAccessLocation(
          actor || {},
          a.location_scope,
          "retain assets for this location",
        );
        const retainedEmployeeId = a.current_employee_id;
        await a.update(
          { status: "Retained", current_employee_id: null, ...toCustodianFields(null) },
          { transaction: t },
        );
        const retainedCustodian =
          retainedEmployeeId != null
            ? { id: String(retainedEmployeeId), type: "EMPLOYEE" }
            : null;
        await AssetEvent.create(
          {
            asset_id: a.id,
            event_type: "Retained",
            event_date: new Date(),
            from_employee_id: retainedEmployeeId,
            from_custodian_id: retainedCustodian?.id ?? null,
            from_custodian_type: retainedCustodian?.type ?? null,
            to_custodian_id: retainedCustodian?.id ?? null,
            to_custodian_type: retainedCustodian?.type ?? null,
            ...toCustodianFields(retainedCustodian),
            location_scope: assetLocationScope,
            notes: notes || null,
            approval_document_url: approvalDocumentUrl || null,
          },
          { transaction: t },
        );
      }

      // No stock delta here by design:
      // retained assets were already deducted when they were issued from store.

      await t.commit();
      return { affected: assets.length };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /* =====================================
     ✅ 1. Get Asset Count Grouped By Category
  ===================================== */
  async getAssetsGroupedByCategory({
    search = "",
    limit = null,
    cursor = null,
    cursorMode = false,
    viewerActor = null,
  } = {}) {
    try {
      const where = { is_active: true };
      const locationWhere = buildLocationScopeWhere(viewerActor || {});
      if (locationWhere) {
        Object.assign(where, locationWhere);
      }
      const useCursorMode = Boolean(cursorMode) && limit != null;
      const safeLimit = useCursorMode ? normalizeLimit(limit, 100, 500) : null;
      const cursorParts = useCursorMode ? decodeCursor(cursor) : null;

      if (
        useCursorMode &&
        cursorParts &&
        Number.isFinite(Number(cursorParts.item_category_id))
      ) {
        where.item_category_id = { [Op.lt]: Number(cursorParts.item_category_id) };
      }

      const searchTerm = String(search || "").trim();
      const itemCategoryWhere =
        searchTerm !== ""
          ? { category_name: { [Op.like]: `%${searchTerm}%` } }
          : undefined;

      const rowsWithMaybeExtra = await Asset.findAll({
        where,
        attributes: [
          "item_category_id",
          [sequelize.col("ItemCategory.category_name"), "category_name"],
          [sequelize.fn("COUNT", sequelize.col("Asset.id")), "total_assets"],
        ],
        include: [
          {
            model: ItemCategory,
            attributes: ["category_name"],
            ...(itemCategoryWhere ? { where: itemCategoryWhere, required: true } : {}),
          },
        ],
        group: [
          "item_category_id",
          "ItemCategory.id",
          "ItemCategory.category_name",
        ],
        order: [["item_category_id", "DESC"]],
        ...(useCursorMode ? { limit: safeLimit + 1 } : {}),
        raw: true,
      });

      if (!useCursorMode) {
        return rowsWithMaybeExtra;
      }

      const hasMore = rowsWithMaybeExtra.length > safeLimit;
      const rows = hasMore
        ? rowsWithMaybeExtra.slice(0, safeLimit)
        : rowsWithMaybeExtra;
      const nextCursor =
        hasMore && rows.length
          ? encodeCursor({
              item_category_id: Number(rows[rows.length - 1].item_category_id),
            })
          : null;

      return {
        rows,
        meta: {
          limit: safeLimit,
          hasMore,
          nextCursor,
          mode: "cursor",
        },
      };
    } catch (error) {
      console.error("Repository error in getAssetsGroupedByCategory", error);
      throw error;
    }
  }

  /* =====================================
     ✅ 2. Get Assets By Category Id
  ===================================== */
  async getAssetsByCategory(
    categoryId,
    { limit = null, cursor = null, cursorMode = false, viewerActor = null } = {},
  ) {
    try {
      const where = {
        item_category_id: categoryId,
        is_active: true,
      };
      const locationWhere = buildLocationScopeWhere(viewerActor || {});
      if (locationWhere) {
        Object.assign(where, locationWhere);
      }
      const useCursorMode = Boolean(cursorMode) && limit != null;
      const safeLimit = useCursorMode ? normalizeLimit(limit, 100, 500) : null;
      const cursorParts = useCursorMode ? decodeCursor(cursor) : null;
      const cursorWhere = useCursorMode
        ? applyIdDescCursor(where, cursorParts, "id")
        : where;

      const rowsWithMaybeExtra = await Asset.findAll({
        where: cursorWhere,
        include: [
          {
            model: ItemCategory,
            attributes: ["category_name"],
          },
        ],
        order: [["id", "DESC"]],
        ...(useCursorMode ? { limit: safeLimit + 1 } : {}),
      });

      if (!useCursorMode) {
        return rowsWithMaybeExtra;
      }

      const hasMore = rowsWithMaybeExtra.length > safeLimit;
      const rows = hasMore
        ? rowsWithMaybeExtra.slice(0, safeLimit)
        : rowsWithMaybeExtra;
      const nextCursor =
        hasMore && rows.length
          ? encodeCursor({ id: rows[rows.length - 1].id })
          : null;

      return {
        rows,
        meta: {
          limit: safeLimit,
          hasMore,
          nextCursor,
          mode: "cursor",
        },
      };
    } catch (error) {
      console.error("Repository error in getAssetsByCategory", error);
      throw error;
    }
  }
  async findAll({
    filters,
    page = 1,
    limit = 50,
    cursor = null,
    cursorMode = false,
    viewerActor = null,
  }) {
    const where = {};
    where.is_active = true;
    const locationWhere = buildLocationScopeWhere(viewerActor || {});
    if (locationWhere) {
      Object.assign(where, locationWhere);
    }

    if (filters.status) where.status = filters.status;
    if (filters.category_id) where.item_category_id = filters.category_id;
    if (filters.employee_id) where.current_employee_id = filters.employee_id;
    if (filters.custodian_id) where.custodian_id = String(filters.custodian_id);
    if (filters.custodian_type) {
      where.custodian_type = String(filters.custodian_type).trim().toUpperCase();
    }
    if (filters.stock_id) where.stock_id = filters.stock_id;

    // if (filters.search) {
    //   where[Op.or] = [
    //     { asset_tag: { [Op.iLike]: `%${filters.search}%` } },
    //     { serial_number: { [Op.iLike]: `%${filters.search}%` } },
    //   ];
    // }

    if (filters.search) {
      const q = `%${filters.search}%`;
      where[Op.or] = [
        { asset_tag: { [Op.like]: q } },
        { serial_number: { [Op.like]: q } },
        { "$Employee.name$": { [Op.like]: q } },
        { "$Employee.division$": { [Op.like]: q } },
        { "$Custodian.id$": { [Op.like]: q } },
        { "$Custodian.display_name$": { [Op.like]: q } },
        { "$Custodian.location$": { [Op.like]: q } },
        { "$ItemCategory.category_name$": { [Op.like]: q } },
      ];
    }

    if (filters.from_date && filters.to_date) {
      where.createdAt = {
        [Op.between]: [filters.from_date, filters.to_date],
      };
    }

    // return Asset.findAndCountAll({
    //   where,
    //   limit,
    //   offset,
    //   order: [["createdAt", "DESC"]],
    // });
    const headInclude = {
      model: ItemCategoryHead,
      as: "head",
      attributes: ["id", "category_head_name"],
      required: false,
    };

    const groupInclude = {
      model: ItemCategoryGroup,
      as: "group",
      attributes: ["id", "category_group_name", "head_id"],
      required: false,
      include: [headInclude],
    };

    const itemCategoryInclude = {
      model: ItemCategory,
      attributes: ["id", "category_name", "group_id"],
      required: false,
      include: [groupInclude],
    };

    if (filters.category_group_id) {
      itemCategoryInclude.required = true;
      itemCategoryInclude.where = { group_id: filters.category_group_id };
    }

    if (filters.category_head_id) {
      itemCategoryInclude.required = true;
      groupInclude.required = true;
      headInclude.required = true;
      headInclude.where = { id: filters.category_head_id };
    }

    const baseQuery = {
      where,
      include: [
        {
          model: Employee,
          attributes: [
            "emp_id",
            "name",
            "division",
            "designation",
            "office_location",
          ],
          required: false,
        },
        {
          model: Custodian,
          attributes: ["id", "custodian_type", "display_name", "location", "is_active"],
          required: false,
        },
        itemCategoryInclude,
        {
          model: DayBook,
          attributes: ["id", "entry_no"],
          required: false,
        },
        {
          model: Vendors,
          attributes: ["id", "name"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    };

    const safeLimit = normalizeLimit(limit, 50, 500);
    const useCursorMode = Boolean(cursorMode);

    if (useCursorMode) {
      const cursorParts = decodeCursor(cursor);
      const cursorWhere = applyDateIdDescCursor(where, cursorParts, "createdAt", "id");
      const rowsWithExtra = await Asset.findAll({
        ...baseQuery,
        where: cursorWhere,
        limit: safeLimit + 1,
      });
      const hasMore = rowsWithExtra.length > safeLimit;
      const rows = hasMore ? rowsWithExtra.slice(0, safeLimit) : rowsWithExtra;
      const nextCursor =
        hasMore && rows.length
          ? encodeCursor({
              createdAt:
                rows[rows.length - 1].createdAt instanceof Date
                  ? rows[rows.length - 1].createdAt.toISOString()
                  : new Date(rows[rows.length - 1].createdAt).toISOString(),
              id: rows[rows.length - 1].id,
            })
          : null;

      return {
        rows,
        meta: {
          limit: safeLimit,
          hasMore,
          nextCursor,
          mode: "cursor",
        },
      };
    }

    const safePage = Math.max(1, Number(page) || 1);
    const offset = (safePage - 1) * safeLimit;

    return Asset.findAndCountAll({
      ...baseQuery,
      limit: safeLimit,
      offset,
    });
  }
}

module.exports = AssetRepository;
