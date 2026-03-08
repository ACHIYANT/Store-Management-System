const {
  IssuedItem,
  Asset,
  AssetEvent,
  ItemCategory,
  Stock,
  Employee,
  Requisition,
  RequisitionItem,
  DayBookItem,
  DayBook,
  sequelize,
} = require("../models");
const RequisitionRepository = require("./requisition-repository");

const { Op, literal } = require("sequelize");
const {
  decodeCursor,
  encodeCursor,
  normalizeLimit,
  applyDateIdDescCursor,
} = require("../utils/cursor-pagination");
const { normalizeSkuUnit, sameSkuUnit } = require("../utils/sku-units");
const { ensureItemMaster } = require("../services/item-master-service");
const { logStockMovement } = require("../services/stock-movement-service");

class IssuedItemRepository {
  _toPositiveIntOrNull(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  async issueItem({
    stockId,
    employeeId,
    quantity,
    requisitionUrl = null,
    skuUnit = null,
  }) {
    const t = await sequelize.transaction();
    try {
      // Approval gate: only allow when the related daybook is approved (level 3)
      const link = await DayBookItem.findOne({
        where: { stock_id: stockId },
        include: [{ model: DayBook }],
        transaction: t,
      });
      if (!link) throw new Error("DayBookItem not found for this stock");
      if (link.DayBook?.approval_level !== 3) {
        throw new Error(
          "DayBook entry not approved (approval_level must be 3)",
        );
      }
      // basic validations
      if (!stockId || !employeeId) {
        throw new Error("stockId and employeeId are required");
      }
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error("quantity must be a positive number");
      }

      // 1) Lock & load the stock row
      // const stock = await Stock.findByPk(stockId, {
      //   transaction: t,
      //   lock: t.LOCK.UPDATE, // pessimistic lock to avoid race conditions
      // });
      const stock = await Stock.findOne({
        where: { id: stockId, is_active: true },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!stock) throw new Error("Stock item not found");
      if (stock.quantity < qty) {
        throw new Error(`Insufficient stock. Available: ${stock.quantity}`);
      }
      const normalizedSkuUnit = normalizeSkuUnit(skuUnit ?? stock.sku_unit);
      if (!sameSkuUnit(normalizedSkuUnit, stock.sku_unit || "Unit")) {
        throw new Error(
          `SKU unit mismatch for stock ${stockId}. Expected ${stock.sku_unit || "Unit"}`,
        );
      }
      let itemMasterId = Number(stock.item_master_id || 0);
      if (!Number.isFinite(itemMasterId) || itemMasterId <= 0) {
        const ensuredItemMaster = await ensureItemMaster({
          itemCategoryId: stock.item_category_id,
          skuUnit: stock.sku_unit || normalizedSkuUnit,
          itemName: stock.item_name,
          aliasText: stock.item_name,
          transaction: t,
        });
        itemMasterId = Number(ensuredItemMaster?.id || 0);
        if (itemMasterId > 0) {
          await stock.update(
            { item_master_id: itemMasterId },
            { transaction: t },
          );
        }
      }

      // 2) (Optional) ensure employee exists (PK is emp_id)
      const employee = await Employee.findByPk(employeeId, { transaction: t });
      if (!employee) throw new Error("Employee not found");

      // 3) Decrement stock
      await stock.update(
        { quantity: stock.quantity - qty },
        { transaction: t },
      );

      // 4) Create IssuedItem row (uses employee_id & item_id columns)
      const issued = await IssuedItem.create(
        {
          employee_id: employeeId,
          item_id: stockId,
          item_master_id: itemMasterId > 0 ? itemMasterId : null,
          quantity: qty,
          sku_unit: normalizedSkuUnit,
          date: new Date(),
          requisition_url: requisitionUrl, // <— FIX: save it if provided
          source: "OFFLINE_REQUISITION",
        },
        { transaction: t },
      );

      await logStockMovement(
        {
          itemMasterId,
          stockId,
          movementType: "ISSUE_OUT",
          qty: -Math.abs(qty),
          skuUnit: normalizedSkuUnit,
          movementAt: issued.date || new Date(),
          referenceType: "IssuedItem",
          referenceId: issued.id,
          toEmployeeId: employeeId,
          performedBy: "Store Issue",
          remarks: requisitionUrl ? "Issued against requisition" : "Issued",
        },
        { transaction: t },
      );

      await t.commit();
      return issued.get({ plain: true });
    } catch (error) {
      await t.rollback();
      console.error("Error issuing item:", error);
      throw error;
    }
  }

  async issueSerialized({
    stockId,
    employeeId,
    assetIds = [],
    requisitionUrl = null,
    skuUnit = null,
  }) {
    const { Asset, AssetEvent } = require("../models");
    const t = await sequelize.transaction();
    try {
      if (
        !stockId ||
        !employeeId ||
        !Array.isArray(assetIds) ||
        assetIds.length === 0
      ) {
        throw new Error("stockId, employeeId and assetIds[] are required");
      }

      // Approval gate
      const link = await DayBookItem.findOne({
        where: { stock_id: stockId },
        include: [{ model: DayBook }],
        transaction: t,
      });
      if (!link) throw new Error("DayBookItem not found for this stock");
      if (link.DayBook?.approval_level !== 3) {
        throw new Error(
          "DayBook entry not approved (approval_level must be 3)",
        );
      }

      // Lock stock and check employee
      // const stock = await Stock.findByPk(stockId, {
      //   transaction: t,
      //   lock: t.LOCK.UPDATE,
      // });
      const stock = await Stock.findOne({
        where: { id: stockId, is_active: true },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!stock) throw new Error("Stock item not found");
      const normalizedSkuUnit = normalizeSkuUnit(skuUnit ?? stock.sku_unit);
      if (!sameSkuUnit(normalizedSkuUnit, stock.sku_unit || "Unit")) {
        throw new Error(
          `SKU unit mismatch for stock ${stockId}. Expected ${stock.sku_unit || "Unit"}`,
        );
      }
      let itemMasterId = Number(stock.item_master_id || 0);
      if (!Number.isFinite(itemMasterId) || itemMasterId <= 0) {
        const ensuredItemMaster = await ensureItemMaster({
          itemCategoryId: stock.item_category_id,
          skuUnit: stock.sku_unit || normalizedSkuUnit,
          itemName: stock.item_name,
          aliasText: stock.item_name,
          transaction: t,
        });
        itemMasterId = Number(ensuredItemMaster?.id || 0);
        if (itemMasterId > 0) {
          await stock.update(
            { item_master_id: itemMasterId },
            { transaction: t },
          );
        }
      }
      const emp = await Employee.findByPk(employeeId, { transaction: t });
      if (!emp) throw new Error("Employee not found");

      // Fetch assets to issue
      const assets = await Asset.findAll({
        where: {
          id: assetIds,
          stock_id: stockId,
          status: "InStore",
          is_active: true,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (assets.length !== assetIds.length) {
        throw new Error("One or more assets are invalid or not InStore");
      }

      // Ensure stock has enough and decrement by number of assets
      const n = assets.length;
      if (stock.quantity < n) {
        throw new Error(`Insufficient stock. Available: ${stock.quantity}`);
      }
      await stock.update({ quantity: stock.quantity - n }, { transaction: t });

      // Create IssuedItem record once
      const issued = await IssuedItem.create(
        {
          employee_id: employeeId,
          item_id: stockId,
          item_master_id: itemMasterId > 0 ? itemMasterId : null,
          quantity: assets.length,
          sku_unit: normalizedSkuUnit,
          date: new Date(),
          requisition_url: requisitionUrl, // <— FIX
          source: "OFFLINE_REQUISITION",
        },
        { transaction: t },
      );

      await logStockMovement(
        {
          itemMasterId,
          stockId,
          movementType: "ISSUE_OUT",
          qty: -Math.abs(assets.length),
          skuUnit: normalizedSkuUnit,
          movementAt: issued.date || new Date(),
          referenceType: "IssuedItem",
          referenceId: issued.id,
          toEmployeeId: employeeId,
          performedBy: "Store Issue",
          remarks: "Serialized asset issue",
          metadata: {
            asset_ids: assetIds,
          },
        },
        { transaction: t },
      );

      // Update each asset and log event
      for (const a of assets) {
        await a.update(
          { status: "Issued", current_employee_id: employeeId },
          { transaction: t },
        );
        await AssetEvent.create(
          {
            asset_id: a.id,
            event_type: "Issued",
            event_date: new Date(),
            to_employee_id: employeeId,
            issued_item_id: issued.id,
          },
          { transaction: t },
        );
      }

      await t.commit();
      return issued.get({ plain: true });
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  async search({
    page = 1,
    limit = 50,
    cursor = null,
    cursorMode = false,
    currentOnly = false,
    search,
    employeeId,
    categoryId,
    itemType, // Asset | Consumable
    fromDate,
    toDate,
  }) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = normalizeLimit(limit, 50, 500);
    const useCursorMode = Boolean(cursorMode);
    const useCurrentOnly = Boolean(currentOnly);
    const offset = (safePage - 1) * safeLimit;
    const searchTerm = typeof search === "string" ? search.trim() : "";
    const currentHoldingStatuses = new Set(["Issued", "Repair"]);

    const toStartOfDay = (dateStr) => new Date(`${dateStr}T00:00:00.000`);
    const toEndOfDay = (dateStr) => new Date(`${dateStr}T23:59:59.999`);

    /* ---------------- Base WHERE (IssuedItem) ---------------- */
    const issuedWhere = {};

    if (employeeId) {
      issuedWhere.employee_id = employeeId;
    }

    if (fromDate || toDate) {
      issuedWhere.date = {};
      if (fromDate) issuedWhere.date[Op.gte] = toStartOfDay(fromDate);
      if (toDate) issuedWhere.date[Op.lte] = toEndOfDay(toDate);
    }

    /* ---------------- Global Search ---------------- */
    if (searchTerm) {
      const like = `%${searchTerm}%`;
      const searchOr = [
        { sku_unit: { [Op.like]: like } },
        { "$Employee.name$": { [Op.like]: like } },
        { "$Employee.division$": { [Op.like]: like } },
        { "$Stock.item_name$": { [Op.like]: like } },
        { "$Stock.ItemCategory.category_name$": { [Op.like]: like } },
        { "$Requisition.req_no$": { [Op.like]: like } },
        { "$AssetEvents.Asset.serial_number$": { [Op.like]: like } },
        { "$AssetEvents.Asset.asset_tag$": { [Op.like]: like } },
      ];

      const searchAsNumber = Number(searchTerm);
      if (Number.isFinite(searchAsNumber)) {
        searchOr.unshift(
          { id: searchAsNumber },
          { employee_id: searchAsNumber },
        );
      }

      issuedWhere[Op.or] = searchOr;
    }

    /* ---------------- Employee Include ---------------- */
    const employeeInclude = {
      model: Employee,
      attributes: ["emp_id", "name", "division"],
      required: false,
    };

    /* ---------------- Category Include ---------------- */
    const categoryWhere = {};

    if (categoryId) {
      categoryWhere.id = categoryId;
    }

    if (itemType === "Asset") {
      categoryWhere.serialized_required = true;
    } else if (itemType === "Consumable") {
      categoryWhere.serialized_required = false;
    }

    /* ---------------- Stock Include ---------------- */
    const stockInclude = {
      model: Stock,
      attributes: ["id", "item_name", "item_category_id", "sku_unit"],
      required: true,
      include: [
        {
          model: ItemCategory,
          attributes: ["id", "category_name", "serialized_required"],
          where: Object.keys(categoryWhere).length ? categoryWhere : undefined,
          required: !!categoryId || !!itemType,
        },
      ],
    };

    /* ---------------- Asset Include (Serial / Tag Search) ---------------- */
    const assetInclude = {
      model: AssetEvent,
      required: false,
      where: { event_type: "Issued" },
      include: [
        {
          model: Asset,
          attributes: [
            "id",
            "asset_tag",
            "serial_number",
            "status",
            "current_employee_id",
          ],
          required: false,
        },
      ],
    };

    const requisitionInclude = {
      model: Requisition,
      required: false,
      attributes: ["id", "req_no", "status"],
    };

    /* ---------------- Query ---------------- */
    const mapRow = (r) => {
      const cat = r.Stock?.ItemCategory;
      const serialized = !!cat?.serialized_required;

      const rowEmployeeId = Number(r.employee_id);
      const rawAssets =
        r.AssetEvents?.map((ev) => ({
          asset_id: ev.Asset?.id,
          asset_tag: ev.Asset?.asset_tag,
          serial_number: ev.Asset?.serial_number,
          status: ev.Asset?.status || null,
          current_employee_id: ev.Asset?.current_employee_id ?? null,
        })).filter((a) => Boolean(a.asset_id)) || [];

      const filteredAssets =
        useCurrentOnly && serialized
          ? rawAssets.filter(
              (a) =>
                Number(a.current_employee_id) === rowEmployeeId &&
                currentHoldingStatuses.has(String(a.status || "")),
            )
          : rawAssets;

      if (useCurrentOnly && serialized && filteredAssets.length === 0) {
        return null;
      }

      return {
        id: r.id,
        date: r.date,
        employee_id: r.employee_id,
        employee_name: r.Employee?.name || null,
        division: r.Employee?.division || null,
        item_name: r.Stock?.item_name || null,
        sku_unit: r.sku_unit || r.Stock?.sku_unit || "Unit",
        category_name: cat?.category_name || null,
        serialized,
        type_label: serialized ? "Asset" : "Consumable",
        quantity: serialized ? filteredAssets.length : r.quantity,
        assets: filteredAssets.map((a) => ({
          asset_id: a.asset_id,
          asset_tag: a.asset_tag,
          serial_number: a.serial_number,
        })),
        requisition_url: r.requisition_url || null,
        requisition_id: r.requisition_id || r.Requisition?.id || null,
        requisition_req_no: r.Requisition?.req_no || null,
        requisition_status: r.Requisition?.status || null,
        source: r.source || "OFFLINE_REQUISITION",
      };
    };

    const baseQuery = {
      distinct: true,
      subQuery: false,
      order: [
        ["date", "DESC"],
        ["id", "DESC"],
      ],
      include: [
        employeeInclude,
        stockInclude,
        assetInclude,
        requisitionInclude,
      ],
    };

    if (useCursorMode) {
      const cursorParts = decodeCursor(cursor);
      const cursorWhere = applyDateIdDescCursor(
        issuedWhere,
        cursorParts,
        "date",
        "id",
      );

      const rowsWithExtra = await IssuedItem.findAll({
        ...baseQuery,
        where: cursorWhere,
        limit: safeLimit + 1,
      });

      const hasMore = rowsWithExtra.length > safeLimit;
      const rows = hasMore ? rowsWithExtra.slice(0, safeLimit) : rowsWithExtra;
      const mapped = rows.map(mapRow).filter(Boolean);
      const nextCursor =
        hasMore && rows.length
          ? encodeCursor({
              date:
                rows[rows.length - 1].date instanceof Date
                  ? rows[rows.length - 1].date.toISOString()
                  : new Date(rows[rows.length - 1].date).toISOString(),
              id: rows[rows.length - 1].id,
            })
          : null;

      return {
        rows: mapped,
        meta: {
          limit: safeLimit,
          hasMore,
          nextCursor,
          mode: "cursor",
        },
      };
    }

    const { rows, count } = await IssuedItem.findAndCountAll({
      ...baseQuery,
      where: issuedWhere,
      limit: safeLimit,
      offset,
    });

    return {
      rows: rows.map(mapRow).filter(Boolean),
      total: count,
      page: safePage,
      limit: safeLimit,
    };
  }

  // NEW: bulk issuance in a single DB transaction
  async issueMany({
    employeeId,
    items = [],
    serializedItems = [],
    notes = null,
    requisitionUrl = null,
    requisitionId = null,
    actor = null,
  }) {
    return sequelize.transaction(async (t) => {
      // 1) validate employee
      const emp = await Employee.findByPk(employeeId, { transaction: t });
      if (!emp) throw new Error(`Employee not found: ${employeeId}`);

      const results = [];
      const requisitionIdNum = this._toPositiveIntOrNull(requisitionId);
      const requisitionIdProvided =
        requisitionId !== undefined &&
        requisitionId !== null &&
        String(requisitionId).trim() !== "";
      if (requisitionIdProvided && !requisitionIdNum) {
        throw new Error(
          "Invalid requisitionId. It must be a positive integer.",
        );
      }

      let requisitionRow = null;
      const requisitionItemMap = new Map();
      const issuedSource = requisitionIdNum
        ? "ONLINE_REQUISITION"
        : "OFFLINE_REQUISITION";
      if (requisitionIdNum) {
        requisitionRow = await Requisition.findByPk(requisitionIdNum, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!requisitionRow) {
          throw new Error(`Requisition not found: ${requisitionIdNum}`);
        }

        const requesterEmpId = Number(requisitionRow.requester_emp_id);
        if (
          Number.isFinite(requesterEmpId) &&
          Number.isFinite(Number(employeeId)) &&
          requesterEmpId !== Number(employeeId)
        ) {
          throw new Error(
            `Selected requisition ${requisitionIdNum} does not belong to employee ${employeeId}.`,
          );
        }

        const requisitionItems = await RequisitionItem.findAll({
          where: { requisition_id: requisitionIdNum },
          attributes: ["id", "stock_id"],
          transaction: t,
        });
        for (const reqItem of requisitionItems) {
          requisitionItemMap.set(
            Number(reqItem.id),
            Number(reqItem.stock_id || 0),
          );
        }
      }

      const itemConsumptions = [];

      // 2) NON-SERIALIZED items
      for (const it of items) {
        const stockId = Number(it?.stockId);
        const quantity = Number(it?.quantity);
        const requestedSkuUnitInput = it?.sku_unit ?? it?.skuUnit;
        const requisitionItemId = this._toPositiveIntOrNull(
          it?.requisition_item_id,
        );
        const requisitionItemIdProvided =
          it?.requisition_item_id !== undefined &&
          it?.requisition_item_id !== null &&
          String(it?.requisition_item_id).trim() !== "";
        if (!stockId || !quantity)
          throw new Error("stockId and quantity required for items[]");

        if (requisitionItemIdProvided && !requisitionItemId) {
          throw new Error(
            "Invalid requisition_item_id in items[]. It must be a positive integer.",
          );
        }
        if (requisitionItemId && !requisitionIdNum) {
          throw new Error(
            "requisition_item_id was provided in items[] without a valid requisitionId.",
          );
        }
        if (requisitionItemId && requisitionIdNum) {
          const mappedStockId = requisitionItemMap.get(requisitionItemId);
          if (!mappedStockId) {
            throw new Error(
              `Requisition item ${requisitionItemId} is not part of requisition ${requisitionIdNum}.`,
            );
          }
          if (mappedStockId > 0 && Number(mappedStockId) !== Number(stockId)) {
            throw new Error(
              `Requisition item ${requisitionItemId} is mapped to stock ${mappedStockId}, but ${stockId} was provided.`,
            );
          }
        }

        const link = await DayBookItem.findOne({
          where: { stock_id: stockId },
          include: [{ model: DayBook }],
          transaction: t,
        });
        if (!link)
          throw new Error(`DayBookItem not found for stockId ${stockId}`);
        if (link.DayBook?.approval_level !== 3)
          throw new Error(
            "DayBook entry not approved (approval_level must be 3)",
          );

        // const stock = await Stock.findByPk(stockId, {
        //   transaction: t,
        //   lock: t.LOCK.UPDATE,
        // });
        const stock = await Stock.findOne({
          where: { id: stockId, is_active: true },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!stock) throw new Error(`Stock not found: ${stockId}`);
        const requestedSkuUnit = normalizeSkuUnit(
          requestedSkuUnitInput ?? stock.sku_unit,
        );
        if (!sameSkuUnit(requestedSkuUnit, stock.sku_unit || "Unit")) {
          throw new Error(
            `SKU unit mismatch for stock ${stockId}. Expected ${stock.sku_unit || "Unit"}`,
          );
        }
        let itemMasterId = Number(stock.item_master_id || 0);
        if (!Number.isFinite(itemMasterId) || itemMasterId <= 0) {
          const ensuredItemMaster = await ensureItemMaster({
            itemCategoryId: stock.item_category_id,
            skuUnit: stock.sku_unit || requestedSkuUnit,
            itemName: stock.item_name,
            aliasText: stock.item_name,
            transaction: t,
          });
          itemMasterId = Number(ensuredItemMaster?.id || 0);
          if (itemMasterId > 0) {
            await stock.update(
              { item_master_id: itemMasterId },
              { transaction: t },
            );
          }
        }

        let remaining = quantity;
        const allocations = [];

        if (stock.quantity > 0) {
          const take = Math.min(remaining, Number(stock.quantity));
          if (take > 0) {
            allocations.push({ stockRow: stock, takeQty: take });
            remaining -= take;
          }
        }

        if (remaining > 0 && itemMasterId > 0) {
          const siblingLots = await Stock.findAll({
            where: {
              item_master_id: itemMasterId,
              sku_unit: requestedSkuUnit,
              is_active: true,
              quantity: { [Op.gt]: 0 },
              id: { [Op.ne]: stock.id },
            },
            order: [["id", "ASC"]],
            transaction: t,
            lock: t.LOCK.UPDATE,
          });

          for (const lot of siblingLots) {
            if (remaining <= 0) break;
            const take = Math.min(remaining, Number(lot.quantity || 0));
            if (take <= 0) continue;
            allocations.push({ stockRow: lot, takeQty: take });
            remaining -= take;
          }
        }

        if (remaining > 0) {
          const available = quantity - remaining;
          throw new Error(`Insufficient stock. Available: ${available}`);
        }

        const issuedRows = [];
        for (const allocation of allocations) {
          const lot = allocation.stockRow;
          const takeQty = Number(allocation.takeQty || 0);
          if (takeQty <= 0) continue;

          await lot.update(
            { quantity: Number(lot.quantity || 0) - takeQty },
            { transaction: t },
          );

          const lotItemMasterId = Number(
            lot.item_master_id || itemMasterId || 0,
          );
          const issued = await IssuedItem.create(
            {
              employee_id: employeeId,
              item_id: lot.id,
              item_master_id: lotItemMasterId > 0 ? lotItemMasterId : null,
              quantity: takeQty,
              sku_unit: requestedSkuUnit,
              date: new Date(),
              requisition_url: requisitionUrl || null,
              requisition_id: requisitionIdNum,
              requisition_item_id: requisitionItemId,
              source: issuedSource,
            },
            { transaction: t },
          );

          await logStockMovement(
            {
              itemMasterId: lotItemMasterId,
              stockId: lot.id,
              movementType: "ISSUE_OUT",
              qty: -Math.abs(takeQty),
              skuUnit: requestedSkuUnit,
              movementAt: issued.date || new Date(),
              referenceType: "IssuedItem",
              referenceId: issued.id,
              toEmployeeId: employeeId,
              performedBy: actor?.fullname || actor?.name || "Store Issue",
              remarks: "Bulk issue (non-serialized)",
              metadata: {
                requisition_id: requisitionIdNum,
                requisition_item_id: requisitionItemId,
                source_stock_id: stockId,
              },
            },
            { transaction: t },
          );

          issuedRows.push({
            issued_id: issued.id,
            stock_id: lot.id,
            quantity: takeQty,
            sku_unit: requestedSkuUnit,
          });
        }

        if (requisitionIdNum && requisitionItemId) {
          itemConsumptions.push({
            requisition_item_id: requisitionItemId,
            issued_qty: quantity,
          });
        }

        results.push({
          type: "non-serialized",
          issued_ids: issuedRows.map((row) => row.issued_id),
          stock_ids: issuedRows.map((row) => row.stock_id),
          issued_breakup: issuedRows,
          stock_id: stockId,
          quantity,
          sku_unit: requestedSkuUnit,
          requisition_item_id: requisitionItemId,
        });
      }

      // 3) SERIALIZED items
      for (const s of serializedItems) {
        const stockId = Number(s?.stockId);
        const assetIds = (s?.assetIds || []).map(Number);
        const requestedSkuUnitInput = s?.sku_unit ?? s?.skuUnit;
        const requisitionItemId = this._toPositiveIntOrNull(
          s?.requisition_item_id,
        );
        const requisitionItemIdProvided =
          s?.requisition_item_id !== undefined &&
          s?.requisition_item_id !== null &&
          String(s?.requisition_item_id).trim() !== "";
        if (!stockId || !assetIds.length)
          throw new Error(
            "stockId and assetIds[] required for serializedItems[]",
          );

        if (requisitionItemIdProvided && !requisitionItemId) {
          throw new Error(
            "Invalid requisition_item_id in serializedItems[]. It must be a positive integer.",
          );
        }
        if (requisitionItemId && !requisitionIdNum) {
          throw new Error(
            "requisition_item_id was provided in serializedItems[] without a valid requisitionId.",
          );
        }
        if (requisitionItemId && requisitionIdNum) {
          const mappedStockId = requisitionItemMap.get(requisitionItemId);
          if (!mappedStockId) {
            throw new Error(
              `Requisition item ${requisitionItemId} is not part of requisition ${requisitionIdNum}.`,
            );
          }
          if (mappedStockId > 0 && Number(mappedStockId) !== Number(stockId)) {
            throw new Error(
              `Requisition item ${requisitionItemId} is mapped to stock ${mappedStockId}, but ${stockId} was provided.`,
            );
          }
        }

        const link = await DayBookItem.findOne({
          where: { stock_id: stockId },
          include: [{ model: DayBook }],
          transaction: t,
        });
        if (!link)
          throw new Error(`DayBookItem not found for stockId ${stockId}`);
        if (link.DayBook?.approval_level !== 3)
          throw new Error(
            "DayBook entry not approved (approval_level must be 3)",
          );

        // const stock = await Stock.findByPk(stockId, {
        //   transaction: t,
        //   lock: t.LOCK.UPDATE,
        // });
        const stock = await Stock.findOne({
          where: { id: stockId, is_active: true },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!stock) throw new Error(`Stock not found: ${stockId}`);
        const requestedSkuUnit = normalizeSkuUnit(
          requestedSkuUnitInput ?? stock.sku_unit,
        );
        if (!sameSkuUnit(requestedSkuUnit, stock.sku_unit || "Unit")) {
          throw new Error(
            `SKU unit mismatch for stock ${stockId}. Expected ${stock.sku_unit || "Unit"}`,
          );
        }
        let itemMasterId = Number(stock.item_master_id || 0);
        if (!Number.isFinite(itemMasterId) || itemMasterId <= 0) {
          const ensuredItemMaster = await ensureItemMaster({
            itemCategoryId: stock.item_category_id,
            skuUnit: stock.sku_unit || requestedSkuUnit,
            itemName: stock.item_name,
            aliasText: stock.item_name,
            transaction: t,
          });
          itemMasterId = Number(ensuredItemMaster?.id || 0);
          if (itemMasterId > 0) {
            await stock.update(
              { item_master_id: itemMasterId },
              { transaction: t },
            );
          }
        }
        if (stock.quantity < assetIds.length)
          throw new Error(`Insufficient stock. Available: ${stock.quantity}`);

        // validate assets
        const assets = await Asset.findAll({
          where: {
            id: assetIds,
            stock_id: stockId,
            status: "InStore",
            is_active: true,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (assets.length !== assetIds.length) {
          throw new Error(
            `Some assets invalid or not InStore. Asked ${assetIds}, found ${assets.map(
              (a) => a.id,
            )}`,
          );
        }

        await stock.update(
          { quantity: stock.quantity - assetIds.length },
          { transaction: t },
        );

        const issued = await IssuedItem.create(
          {
            employee_id: employeeId,
            item_id: stockId,
            item_master_id: itemMasterId > 0 ? itemMasterId : null,
            quantity: assetIds.length,
            sku_unit: requestedSkuUnit,
            date: new Date(),
            requisition_url: requisitionUrl || null,
            requisition_id: requisitionIdNum,
            requisition_item_id: requisitionItemId,
            source: issuedSource,
          },
          { transaction: t },
        );

        await logStockMovement(
          {
            itemMasterId,
            stockId,
            movementType: "ISSUE_OUT",
            qty: -Math.abs(assetIds.length),
            skuUnit: requestedSkuUnit,
            movementAt: issued.date || new Date(),
            referenceType: "IssuedItem",
            referenceId: issued.id,
            toEmployeeId: employeeId,
            performedBy: actor?.fullname || actor?.name || "Store Issue",
            remarks: "Bulk issue (serialized)",
            metadata: {
              asset_ids: assetIds,
              requisition_id: requisitionIdNum,
              requisition_item_id: requisitionItemId,
            },
          },
          { transaction: t },
        );

        if (requisitionIdNum && requisitionItemId) {
          itemConsumptions.push({
            requisition_item_id: requisitionItemId,
            issued_qty: assetIds.length,
          });
        }

        for (const a of assets) {
          await a.update(
            { status: "Issued", current_employee_id: employeeId },
            { transaction: t },
          );
          await AssetEvent.create(
            {
              asset_id: a.id,
              event_type: "Issued",
              event_date: new Date(),
              to_employee_id: employeeId,
              issued_item_id: issued.id,
              notes: notes || null,
            },
            { transaction: t },
          );
        }

        results.push({
          type: "serialized",
          issued_id: issued.id,
          stock_id: stockId,
          sku_unit: requestedSkuUnit,
          assets: assetIds,
          requisition_item_id: requisitionItemId,
        });
      }

      if (requisitionIdNum && itemConsumptions.length > 0) {
        const requisitionRepo = new RequisitionRepository();
        await requisitionRepo.applyFulfillment({
          requisitionId: requisitionIdNum,
          actor: actor || {
            id: 0,
            fullname: "Store",
            roles: ["STORE_ENTRY"],
          },
          itemConsumptions,
          transaction: t,
        });
      }

      return { employee_id: employeeId, results };
    });
  }
}
module.exports = IssuedItemRepository;
