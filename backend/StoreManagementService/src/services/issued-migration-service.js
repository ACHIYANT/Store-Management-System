"use strict";

const {
  sequelize,
  Employee,
  ItemCategory,
  ItemMaster,
  Stock,
  Asset,
  IssuedItem,
  AssetEvent,
} = require("../models");
const { Op } = require("sequelize");
const { normalizeSkuUnit, sameSkuUnit } = require("../utils/sku-units");
const {
  ensureItemMaster,
  resolveItemMaster,
} = require("./item-master-service");
const { logStockMovement } = require("./stock-movement-service");
const {
  ensureCustodian,
  toCustodianFields,
} = require("../utils/custodian-utils");
const {
  getLocationScopeFromResolvedCustodian,
  normalizeLocationScope,
} = require("../utils/location-scope");
const { buildMigrationActorLabel } = require("../utils/migration-api-utils");

const SOURCE_FLAG = "MIGRATION_ISSUED";
const HISTORICAL_NO_SERIAL_PREFIX = "MIG-ASSET-NOSERIAL";
const HISTORICAL_NO_SERIAL_NOTE =
  "Migrated asset without serial number";

class IssuedMigrationService {
  _buildImportContext(context = {}) {
    return {
      performed_by:
        context?.actorLabel ||
        buildMigrationActorLabel(context?.actorMeta?.requested_by || context),
    };
  }

  _collectResolvedLocations(details = []) {
    return [
      ...new Set(
        (details || [])
          .map((entry) => normalizeLocationScope(entry?.location_scope || null))
          .filter(Boolean),
      ),
    ];
  }

  static normalizeKey(key) {
    return String(key || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  static toBool(value, fallback = false) {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "boolean") return value;
    const raw = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(raw)) return true;
    if (["0", "false", "no", "n", "off"].includes(raw)) return false;
    return fallback;
  }

  static toInteger(value) {
    if (value === undefined || value === null || value === "") return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return Number.isInteger(num) ? num : null;
  }

  static parseDate(value) {
    if (value === undefined || value === null || value === "") return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "number") {
      const dt = new Date(Math.round((value - 25569) * 86400 * 1000));
      return Number.isNaN(dt.getTime()) ? null : dt;
    }

    if (typeof value === "string") {
      const dt = new Date(value);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }

    return null;
  }

  static normalizeRow(rawRow = {}, rowNo = 0) {
    const row = {};
    Object.entries(rawRow || {}).forEach(([key, value]) => {
      row[IssuedMigrationService.normalizeKey(key)] = value;
    });

    const get = (...aliases) => {
      for (const alias of aliases) {
        const val = row[IssuedMigrationService.normalizeKey(alias)];
        if (val !== undefined) return val;
      }
      return null;
    };

    const resolvedRowNo =
      IssuedMigrationService.toInteger(get("row_no", "rowno")) || rowNo;

    return {
      row_no: resolvedRowNo,
      sheet_name: get("sheet_name", "sheet"),
      item_no:
        IssuedMigrationService.toInteger(get("item_no", "s_no", "s.no")) ||
        resolvedRowNo,
      employee_emp_id: IssuedMigrationService.toInteger(
        get("employee_emp_id", "employee_id", "emp_id"),
      ),
      employee_name: get("employee_name", "name"),
      division: get("division"),
      custodian_id: get("custodian_id"),
      custodian_type: get("custodian_type"),
      custodian_name: get("custodian_name", "display_name"),
      custodian_location: get("custodian_location", "location"),
      stock_id: IssuedMigrationService.toInteger(get("stock_id")),
      item_name: get("item_name", "stock_name"),
      item_master_id: IssuedMigrationService.toInteger(
        get("item_master_id", "master_id"),
      ),
      item_code: get("item_code", "item_master_code", "master_code"),
      category_id: IssuedMigrationService.toInteger(
        get("category_id", "item_category_id"),
      ),
      category_name: get("category_name", "item_category_name"),
      serial_number: get("serial_number", "serial_no"),
      asset_tag: get("asset_tag"),
      quantity: IssuedMigrationService.toInteger(get("quantity", "qty")),
      sku_unit: get("sku_unit", "sku", "unit", "uom"),
      item_type: get("item_type", "type", "entry_type"),
      issue_date: get("issue_date", "date", "issued_on"),
      remarks: get("remarks", "note", "notes"),
      source_ref: get("source_ref", "source_reference", "ref_no"),
    };
  }

  _buildSheetRows(sheetRows = []) {
    return (sheetRows || [])
      .map((raw, index) => IssuedMigrationService.normalizeRow(raw, index + 2))
      .filter((r) =>
        Object.values(r).some((v) => v !== null && v !== undefined && v !== ""),
      );
  }

  _buildEventNotes({ sourceRef, remarks }) {
    const parts = [SOURCE_FLAG];
    if (sourceRef) parts.push(`source_ref:${String(sourceRef).trim()}`);
    if (remarks) parts.push(String(remarks).trim());
    return parts.join(" | ");
  }

  _normalizeSerial(value) {
    if (value === undefined || value === null) return null;
    const clean = String(value).trim();
    return clean || null;
  }

  _normalizeText(value) {
    if (value === undefined || value === null) return null;
    const clean = String(value).trim();
    return clean || null;
  }

  _buildAutoAssetTag({ stockId, assetId, categoryName }) {
    const safeCategory = String(categoryName || "AST")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4) || "AST";
    const yy = new Date().getFullYear();
    return `${safeCategory}-${yy}-${stockId}-${assetId}`;
  }

  _buildHistoricalNoSerialValue({ stockId, rowNo, index }) {
    return `${HISTORICAL_NO_SERIAL_PREFIX}-${stockId}-${rowNo}-${Date.now()}-${String(index).padStart(3, "0")}`;
  }

  async _findCategory({ categoryId, categoryName }, transaction = null) {
    if (categoryId) {
      return ItemCategory.findByPk(categoryId, { transaction });
    }
    if (!categoryName) return null;
    const matches = await ItemCategory.findAll({
      where: { category_name: String(categoryName).trim() },
      limit: 3,
      order: [["id", "ASC"]],
      transaction,
    });
    if (matches.length > 1) {
      throw new Error(
        `Multiple categories found for category_name '${String(categoryName).trim()}'. Use category_id or item_master_id/item_code.`,
      );
    }
    return matches[0] || null;
  }

  async _findItemMaster(
    {
      itemMasterId = null,
      itemCode = null,
      categoryId = null,
      skuUnit = null,
      itemName = null,
    },
    transaction = null,
  ) {
    const masterId = IssuedMigrationService.toInteger(itemMasterId);
    if (masterId) {
      return ItemMaster.findOne({
        where: { id: masterId, is_active: true },
        include: [{ model: ItemCategory, attributes: ["id", "category_name"] }],
        transaction,
      });
    }

    const code = this._normalizeText(itemCode);
    if (code) {
      return ItemMaster.findOne({
        where: { item_code: code, is_active: true },
        include: [{ model: ItemCategory, attributes: ["id", "category_name"] }],
        transaction,
      });
    }

    const cleanName = this._normalizeText(itemName);
    if (!cleanName) return null;

    const resolution = await resolveItemMaster({
      itemCategoryId: categoryId || null,
      skuUnit: skuUnit || "Unit",
      itemName: cleanName,
      autoCreate: false,
      transaction,
      maxSuggestions: 5,
    });

    if (!resolution?.itemMaster?.id) return null;

    return ItemMaster.findOne({
      where: { id: resolution.itemMaster.id, is_active: true },
      include: [{ model: ItemCategory, attributes: ["id", "category_name"] }],
      transaction,
    });
  }

  async _findStock(
    {
      stockId,
      itemName,
      itemMasterId = null,
      categoryId,
      skuUnit,
    },
    transaction = null,
  ) {
    if (stockId) {
      return Stock.findOne({
        where: { id: stockId, is_active: true },
        include: [{ model: ItemCategory, attributes: ["id", "category_name"] }],
        transaction,
      });
    }

    const masterId = IssuedMigrationService.toInteger(itemMasterId);
    if (masterId) {
      const whereByMaster = { is_active: true, item_master_id: masterId };
      if (skuUnit) whereByMaster.sku_unit = skuUnit;
      if (categoryId) whereByMaster.item_category_id = categoryId;

      const byMaster = await Stock.findOne({
        where: whereByMaster,
        include: [{ model: ItemCategory, attributes: ["id", "category_name"] }],
        order: [["quantity", "DESC"], ["id", "DESC"]],
        transaction,
      });
      if (byMaster) return byMaster;
    }

    if (!itemName) return null;
    const cleanItemName = this._normalizeText(itemName);
    if (!cleanItemName) return null;

    const where = {
      item_name: cleanItemName,
      is_active: true,
    };
    if (categoryId) where.item_category_id = categoryId;
    if (skuUnit) where.sku_unit = skuUnit;

    const exact = await Stock.findOne({
      where,
      include: [{ model: ItemCategory, attributes: ["id", "category_name"] }],
      order: [["quantity", "DESC"], ["id", "DESC"]],
      transaction,
    });
    if (exact) return exact;

    const itemMasterResolved = await resolveItemMaster({
      itemCategoryId: categoryId || null,
      skuUnit: skuUnit || "Unit",
      itemName: cleanItemName,
      autoCreate: false,
      transaction,
      maxSuggestions: 5,
    });

    if (itemMasterResolved?.itemMaster?.id) {
      const whereByMaster = { is_active: true, item_master_id: itemMasterResolved.itemMaster.id };
      if (skuUnit) whereByMaster.sku_unit = skuUnit;
      if (categoryId) whereByMaster.item_category_id = categoryId;

      const byMaster = await Stock.findOne({
        where: whereByMaster,
        include: [{ model: ItemCategory, attributes: ["id", "category_name"] }],
        order: [["quantity", "DESC"], ["id", "DESC"]],
        transaction,
      });
      if (byMaster) return byMaster;
    }

    const fuzzyWhere = {
      is_active: true,
      item_name: { [Op.like]: `%${cleanItemName}%` },
    };
    if (categoryId) fuzzyWhere.item_category_id = categoryId;
    if (skuUnit) fuzzyWhere.sku_unit = skuUnit;

    return Stock.findOne({
      where: fuzzyWhere,
      include: [{ model: ItemCategory, attributes: ["id", "category_name"] }],
      order: [["quantity", "DESC"], ["id", "DESC"]],
      transaction,
    });
  }

  async _resolveCommon({
    row,
    options,
    transaction = null,
    writeMode = false,
  }) {
    const providedCustodianFields = [
      "custodian_id",
      "custodian_type",
      "custodian_name",
      "custodian_location",
    ].filter((field) => this._normalizeText(row[field]));
    if (providedCustodianFields.length > 0) {
      throw new Error(
        "Issued migration currently supports employee-based issuance only. Remove custodian columns/values and provide employee_emp_id.",
      );
    }

    const employeeEmpId = IssuedMigrationService.toInteger(row.employee_emp_id);
    if (employeeEmpId == null) {
      throw new Error("employee_emp_id is required for issued migration");
    }

    const resolvedCustodian = await ensureCustodian(
      {
        type: "EMPLOYEE",
        id: String(employeeEmpId),
        employeeId: employeeEmpId,
      },
      {
      transaction,
      },
    );
    const employeeRecord = await Employee.findByPk(resolvedCustodian.employeeId, {
      transaction,
    });
    const employee = employeeRecord
      ? {
          emp_id: employeeRecord.emp_id,
          name: employeeRecord.name,
          division: employeeRecord.division,
        }
      : null;
    const resolvedLocationScope = getLocationScopeFromResolvedCustodian(
      resolvedCustodian,
    );
    if (!resolvedLocationScope) {
      throw new Error(
        "Employee office location is required for issued migration. Please update the employee location before importing.",
      );
    }

    const hasRowSkuUnit =
      row.sku_unit !== undefined &&
      row.sku_unit !== null &&
      String(row.sku_unit).trim() !== "";
    const parsedInputSkuUnit = hasRowSkuUnit
      ? normalizeSkuUnit(row.sku_unit)
      : null;
    const hintedItemMaster = await this._findItemMaster(
      {
        itemMasterId: row.item_master_id,
        itemCode: row.item_code,
        categoryId: row.category_id,
        skuUnit: parsedInputSkuUnit,
        itemName: row.item_name,
      },
      transaction,
    );
    if ((row.item_master_id || row.item_code) && !hintedItemMaster) {
      throw new Error(
        `Item master not found for item_master_id/item_code (${row.item_master_id || row.item_code})`,
      );
    }

    let category = await this._findCategory(
      {
        categoryId: row.category_id,
        categoryName: row.category_name,
      },
      transaction,
    );
    if (!category && hintedItemMaster?.item_category_id) {
      category =
        hintedItemMaster.ItemCategory ||
        (await ItemCategory.findByPk(hintedItemMaster.item_category_id, {
          transaction,
        }));
    }
    if (
      category &&
      hintedItemMaster &&
      Number(category.id) !== Number(hintedItemMaster.item_category_id)
    ) {
      throw new Error(
        `Category and item master mismatch. category_id ${category.id} does not match item_master_id ${hintedItemMaster.id}.`,
      );
    }

    const resolvedCategoryId =
      category?.id || hintedItemMaster?.item_category_id || row.category_id || null;
    const resolvedItemName =
      this._normalizeText(row.item_name) || hintedItemMaster?.display_name || null;

    let stock = await this._findStock(
      {
        stockId: row.stock_id,
        itemName: resolvedItemName,
        itemMasterId: hintedItemMaster?.id || row.item_master_id || null,
        categoryId: resolvedCategoryId,
        skuUnit: parsedInputSkuUnit,
      },
      transaction,
    );
    let resolvedByItemMaster = null;

    if (!stock && IssuedMigrationService.toBool(options.createStockIfMissing, false)) {
      if (!writeMode) {
        return {
          employee,
          custodian: resolvedCustodian,
          category,
          stock: {
            id: null,
            item_category_id: category?.id || row.category_id || null,
            sku_unit: parsedInputSkuUnit || "Unit",
            ItemCategory: category || null,
          },
          location_scope: resolvedLocationScope,
          sku_unit: parsedInputSkuUnit || "Unit",
          willCreateStock: true,
          item_master_id: hintedItemMaster?.id || null,
        };
      }

      if (!category) {
        throw new Error(
          "Stock not found. category_id/category_name is required to auto-create stock",
        );
      }
      const itemName =
        this._normalizeText(row.item_name) || hintedItemMaster?.display_name || null;
      if (!itemName) {
        throw new Error("Stock not found. item_name is required to auto-create stock");
      }
      const ensuredItemMaster =
        hintedItemMaster ||
        (await ensureItemMaster({
          itemCategoryId: category.id,
          skuUnit: parsedInputSkuUnit || "Unit",
          itemName,
          aliasText: itemName,
          transaction,
        }));

      stock = await Stock.create(
        {
          item_name: itemName,
          quantity: 0,
          rate: 0,
          gst_rate: 0,
          amount: 0,
          item_category_id: category.id,
          sku_unit: parsedInputSkuUnit || "Unit",
          item_master_id: ensuredItemMaster?.id || null,
          source: "MIGRATION",
          location_scope: resolvedLocationScope,
        },
        { transaction },
      );

      stock = await Stock.findOne({
        where: { id: stock.id },
        include: [{ model: ItemCategory, attributes: ["id", "category_name"] }],
        transaction,
      });

      resolvedByItemMaster = ensuredItemMaster?.id || null;
    }

    if (!stock) {
      if (resolvedItemName) {
        const resolution = await resolveItemMaster({
          itemCategoryId: resolvedCategoryId || null,
          skuUnit: parsedInputSkuUnit || "Unit",
          itemName: resolvedItemName,
          autoCreate: false,
          transaction,
          maxSuggestions: 5,
        });
        if (resolution?.ambiguous && Array.isArray(resolution.suggestions) && resolution.suggestions.length) {
          throw new Error(
            `Item name is ambiguous. Possible matches: ${resolution.suggestions
              .map((s) => s.display_name)
              .join(", ")}`,
          );
        }
        if (Array.isArray(resolution?.suggestions) && resolution.suggestions.length) {
          throw new Error(
            `Stock not found. Possible item matches: ${resolution.suggestions
              .map((s) => s.display_name)
              .join(", ")}`,
          );
        }
      }
      throw new Error(
        "Stock not found. Provide valid stock_id or item_name/category_name mapping",
      );
    }

    const stockLocationScope = normalizeLocationScope(
      stock.location_scope || resolvedLocationScope,
    );
    if (!stockLocationScope) {
      throw new Error(
        `Stock ${stock.id} is missing location information. Please backfill the stock location before continuing.`,
      );
    }
    if (stockLocationScope !== resolvedLocationScope) {
      throw new Error(
        `Stock ${stock.id} belongs to ${stockLocationScope}, but employee belongs to ${resolvedLocationScope}. Issued migration must stay within one location.`,
      );
    }
    if (!stock.location_scope && writeMode) {
      await stock.update({ location_scope: stockLocationScope }, { transaction });
      stock.location_scope = stockLocationScope;
    }

    if (
      hintedItemMaster &&
      Number(stock.item_master_id || 0) > 0 &&
      Number(stock.item_master_id) !== Number(hintedItemMaster.id)
    ) {
      throw new Error(
        `Stock-item master mismatch. stock_id ${stock.id} belongs to item_master_id ${stock.item_master_id}, not ${hintedItemMaster.id}.`,
      );
    }

    let itemMasterId = Number(
      hintedItemMaster?.id || stock.item_master_id || resolvedByItemMaster || 0,
    );
    if ((!Number.isFinite(itemMasterId) || itemMasterId <= 0) && writeMode) {
      const ensuredItemMaster = await ensureItemMaster({
        itemCategoryId: stock.item_category_id || resolvedCategoryId,
        skuUnit: stock.sku_unit || parsedInputSkuUnit || "Unit",
        itemName: stock.item_name || resolvedItemName,
        aliasText: resolvedItemName || stock.item_name,
        transaction,
      });
      itemMasterId = Number(ensuredItemMaster?.id || 0);
      if (itemMasterId > 0) {
        await stock.update({ item_master_id: itemMasterId }, { transaction });
      }
    } else if (!Number.isFinite(itemMasterId) || itemMasterId <= 0) {
      const resolvedMaster = await resolveItemMaster({
        itemCategoryId: stock.item_category_id || resolvedCategoryId,
        skuUnit: stock.sku_unit || parsedInputSkuUnit || "Unit",
        itemName: stock.item_name || resolvedItemName,
        autoCreate: false,
        transaction,
      });
      itemMasterId = Number(resolvedMaster?.itemMaster?.id || 0);
    }
    if (
      hintedItemMaster &&
      Number.isFinite(itemMasterId) &&
      itemMasterId > 0 &&
      Number(itemMasterId) !== Number(hintedItemMaster.id)
    ) {
      throw new Error(
        `Resolved item master mismatch. Expected ${hintedItemMaster.id}, got ${itemMasterId}.`,
      );
    }

    const requestedSkuUnit = normalizeSkuUnit(
      parsedInputSkuUnit || stock.sku_unit || "Unit",
    );
    if (!sameSkuUnit(stock.sku_unit || "Unit", requestedSkuUnit)) {
      throw new Error(
        `SKU unit mismatch for stock ${stock.id}. Expected ${stock.sku_unit || "Unit"}, got ${requestedSkuUnit}`,
      );
    }

    if (category && Number(stock.item_category_id) !== Number(category.id)) {
      throw new Error(
        `Stock-category mismatch. stock_id ${stock.id} belongs to category ${stock.item_category_id}`,
      );
    }

    const parsedIssueDate = IssuedMigrationService.parseDate(row.issue_date);
    if (row.issue_date && !parsedIssueDate) {
      throw new Error(`Invalid issue_date: ${row.issue_date}`);
    }

    return {
      employee,
      custodian: resolvedCustodian,
      category: stock.ItemCategory || category || null,
      stock,
      location_scope: stockLocationScope,
      sku_unit: requestedSkuUnit,
      item_master_id: Number.isFinite(itemMasterId) && itemMasterId > 0 ? itemMasterId : null,
      willCreateStock: false,
      issueDate: parsedIssueDate || new Date(),
    };
  }

  async _processSerializedRow({
    row,
    options,
    dryRun = false,
    transaction = null,
    actorLabel = "System Migration",
  }) {
    const serial = this._normalizeSerial(row.serial_number);
    const assetTag = this._normalizeText(row.asset_tag);
    const quantity = IssuedMigrationService.toInteger(row.quantity);
    const isHistoricalNoSerialRow = !serial && !assetTag;

    if (isHistoricalNoSerialRow) {
      if (!quantity || quantity <= 0) {
        throw new Error(
          "quantity must be a whole number greater than 0 when Asset rows do not have serial_number/asset_tag",
        );
      }
    } else if (quantity != null && quantity !== 1) {
      throw new Error(
        "For Asset rows with serial_number/asset_tag, use one row per asset. quantity should be blank or 1.",
      );
    }

    if (!dryRun && !transaction) {
      throw new Error("transaction is required in execute mode");
    }

    const resolved = await this._resolveCommon({
      row,
      options,
      transaction,
      writeMode: !dryRun,
    });
    const resolvedCustodian = resolved.custodian;
    const resolvedEmployeeId = resolvedCustodian?.employeeId ?? null;
    const resolvedCustodianFields = toCustodianFields(resolvedCustodian);
    const issueDate = resolved.issueDate || new Date();
    const locationScope = resolved.location_scope || null;

    if (isHistoricalNoSerialRow) {
      if (dryRun) {
        return {
          status: "ok",
          message: `Will create ${quantity} historical asset record(s) without serial numbers`,
          stock_id: resolved.stock?.id || null,
          item_master_id: resolved.item_master_id || null,
          employee_emp_id: resolvedEmployeeId,
          quantity,
          location_scope: locationScope,
          will_create_stock: !!resolved.willCreateStock,
          will_create_asset: true,
          will_generate_asset_tag: true,
        };
      }

      if (IssuedMigrationService.toBool(options.adjustStock, false)) {
        const stock = await Stock.findOne({
          where: { id: resolved.stock.id, is_active: true },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!stock) {
          throw new Error(`Stock not found during adjustment: ${resolved.stock.id}`);
        }
        if (stock.quantity < quantity) {
          throw new Error(
            `Insufficient stock for adjustment. stock_id ${stock.id}, quantity ${stock.quantity}`,
          );
        }
        await stock.update({ quantity: stock.quantity - quantity }, { transaction });
      }

      const eventNotes = this._buildEventNotes({
        sourceRef: row.source_ref,
        remarks: [row.remarks, HISTORICAL_NO_SERIAL_NOTE]
          .filter(Boolean)
          .join(" | "),
      });

      const issued = await IssuedItem.create(
        {
          employee_id: resolvedEmployeeId,
          ...resolvedCustodianFields,
          item_id: resolved.stock.id,
          item_master_id: resolved.item_master_id || null,
          quantity,
          sku_unit: resolved.sku_unit || resolved.stock.sku_unit || "Unit",
          date: issueDate,
          location_scope: locationScope,
          requisition_url: null,
          requisition_id: null,
          requisition_item_id: null,
          source: "MIGRATION",
        },
        { transaction },
      );

      if (IssuedMigrationService.toBool(options.adjustStock, false)) {
        await logStockMovement(
          {
            itemMasterId: resolved.item_master_id,
            stockId: resolved.stock.id,
            movementType: "ISSUE_OUT",
            qty: -Math.abs(quantity),
            skuUnit: resolved.sku_unit || resolved.stock.sku_unit || "Unit",
            movementAt: issueDate,
            referenceType: "IssuedItem",
            referenceId: issued.id,
            toEmployeeId: resolvedEmployeeId,
            performedBy: actorLabel,
            remarks: "Issued migration (asset without serial number)",
            locationScope,
            metadata: {
              source: SOURCE_FLAG,
              row_no: row.row_no,
              item_no: row.item_no,
              historical_no_serial: true,
            },
          },
          { transaction },
        );
      }

      const createdAssetIds = [];

      for (let index = 1; index <= quantity; index += 1) {
        const createdAsset = await Asset.create(
          {
            serial_number: this._buildHistoricalNoSerialValue({
              stockId: resolved.stock.id,
              rowNo: row.row_no,
              index,
            }),
            asset_tag: null,
            stock_id: resolved.stock.id,
            item_category_id: resolved.stock.item_category_id,
            item_master_id: resolved.item_master_id || null,
            status: "Issued",
            current_employee_id: resolvedEmployeeId,
            ...resolvedCustodianFields,
            location_scope: locationScope,
            notes: eventNotes,
            daybook_id: null,
            daybook_item_id: null,
          },
          { transaction },
        );

        const generatedTag = this._buildAutoAssetTag({
          stockId: resolved.stock.id,
          assetId: createdAsset.id,
          categoryName: resolved.category?.category_name,
        });
        await createdAsset.update({ asset_tag: generatedTag }, { transaction });

        await AssetEvent.create(
          {
            asset_id: createdAsset.id,
            event_type: "Issued",
            event_date: issueDate,
            to_employee_id: resolvedEmployeeId,
            to_custodian_id: resolvedCustodianFields.custodian_id,
            to_custodian_type: resolvedCustodianFields.custodian_type,
            ...resolvedCustodianFields,
            issued_item_id: issued.id,
            daybook_id: null,
            daybook_item_id: null,
            location_scope: locationScope,
            notes: eventNotes,
            performed_by: actorLabel,
          },
          { transaction },
        );

        createdAssetIds.push(createdAsset.id);
      }

      return {
        status: "imported",
        message: `Historical asset row migrated without serial numbers (${quantity} assets created)`,
        stock_id: resolved.stock.id,
        item_master_id: resolved.item_master_id || null,
        employee_emp_id: resolvedEmployeeId,
        quantity,
        location_scope: locationScope,
        asset_count: quantity,
        asset_ids: createdAssetIds,
        issued_item_id: issued.id,
      };
    }

    let asset = null;
    if (serial) {
      asset = await Asset.findOne({
        where: { serial_number: serial, is_active: true },
        transaction,
        lock: transaction ? transaction.LOCK.UPDATE : undefined,
      });
    } else if (assetTag) {
      asset = await Asset.findOne({
        where: { asset_tag: assetTag, is_active: true },
        transaction,
        lock: transaction ? transaction.LOCK.UPDATE : undefined,
      });
    }

    if (asset && Number(asset.stock_id) !== Number(resolved.stock.id)) {
      throw new Error(
        `Asset belongs to stock_id ${asset.stock_id}, but row mapped to ${resolved.stock.id}`,
      );
    }

    if (asset && asset.status === "Issued") {
      const sameCustodian =
        String(asset.custodian_id || "") ===
          String(resolvedCustodianFields.custodian_id || "") &&
        String(asset.custodian_type || "") ===
          String(resolvedCustodianFields.custodian_type || "");
      const sameLegacyEmployee =
        !asset.custodian_id &&
        !asset.custodian_type &&
        resolvedEmployeeId != null &&
        Number(asset.current_employee_id) === Number(resolvedEmployeeId);

      if (sameCustodian || sameLegacyEmployee) {
        return {
          status: "skipped",
          message: "Asset already issued to same employee",
          stock_id: resolved.stock.id,
          item_master_id: resolved.item_master_id || null,
          employee_emp_id: resolvedEmployeeId,
          asset_id: asset.id,
          location_scope: locationScope,
        };
      }

      throw new Error(
        `Asset already issued to another holder (${asset.custodian_id || asset.current_employee_id || "UNKNOWN"})`,
      );
    }

    if (asset && !["InStore", "Issued"].includes(String(asset.status || ""))) {
      throw new Error(`Asset is in '${asset.status}' state and cannot be issued`);
    }

    if (dryRun) {
      return {
        status: "ok",
        message: asset ? "Will update existing asset and issue" : "Will create asset and issue",
        stock_id: resolved.stock?.id || null,
        item_master_id: resolved.item_master_id || null,
        employee_emp_id: resolvedEmployeeId,
        location_scope: locationScope,
        will_create_stock: !!resolved.willCreateStock,
        will_create_asset: !asset,
        will_generate_asset_tag: !asset && !assetTag,
      };
    }

    const eventNotes = this._buildEventNotes({
      sourceRef: row.source_ref,
      remarks: row.remarks,
    });

    if (!asset) {
      const serialValue = serial || `LEGACY-${resolved.stock.id}-${Date.now()}-${row.row_no}`;
      asset = await Asset.create(
        {
          serial_number: serialValue,
          asset_tag: assetTag || null,
          stock_id: resolved.stock.id,
          item_category_id: resolved.stock.item_category_id,
          item_master_id: resolved.item_master_id || null,
          status: "Issued",
          current_employee_id: resolvedEmployeeId,
          ...resolvedCustodianFields,
          location_scope: locationScope,
          notes: eventNotes,
          daybook_id: null,
          daybook_item_id: null,
        },
        { transaction },
      );

      if (!assetTag) {
        const generatedTag = this._buildAutoAssetTag({
          stockId: resolved.stock.id,
          assetId: asset.id,
          categoryName: resolved.category?.category_name,
        });
        await asset.update({ asset_tag: generatedTag }, { transaction });
      }
    } else {
      const noteParts = [asset.notes, eventNotes].filter(Boolean).join(" | ");
      await asset.update(
        {
          item_master_id: asset.item_master_id || resolved.item_master_id || null,
          status: "Issued",
          current_employee_id: resolvedEmployeeId,
          ...resolvedCustodianFields,
          location_scope: locationScope,
          notes: noteParts,
        },
        { transaction },
      );
    }

    if (IssuedMigrationService.toBool(options.adjustStock, false)) {
      const stock = await Stock.findOne({
        where: { id: resolved.stock.id, is_active: true },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!stock) {
        throw new Error(`Stock not found during adjustment: ${resolved.stock.id}`);
      }
      if (stock.quantity <= 0) {
        throw new Error(
          `Insufficient stock for adjustment. stock_id ${stock.id}, quantity ${stock.quantity}`,
        );
      }
      await stock.update({ quantity: stock.quantity - 1 }, { transaction });
    }

    const issued = await IssuedItem.create(
      {
        employee_id: resolvedEmployeeId,
        ...resolvedCustodianFields,
        item_id: resolved.stock.id,
        item_master_id: resolved.item_master_id || null,
        quantity: 1,
        sku_unit: resolved.sku_unit || resolved.stock.sku_unit || "Unit",
        date: issueDate,
        location_scope: locationScope,
        requisition_url: null,
        requisition_id: null,
        requisition_item_id: null,
        source: "MIGRATION",
      },
      { transaction },
    );

    if (IssuedMigrationService.toBool(options.adjustStock, false)) {
      await logStockMovement(
        {
          itemMasterId: resolved.item_master_id,
          stockId: resolved.stock.id,
          movementType: "ISSUE_OUT",
          qty: -1,
          skuUnit: resolved.sku_unit || resolved.stock.sku_unit || "Unit",
          movementAt: issueDate,
          referenceType: "IssuedItem",
          referenceId: issued.id,
          toEmployeeId: resolvedEmployeeId,
          performedBy: actorLabel,
          remarks: "Issued migration (asset)",
          locationScope,
          metadata: {
            source: SOURCE_FLAG,
            row_no: row.row_no,
            item_no: row.item_no,
          },
        },
        { transaction },
      );
    }

    await AssetEvent.create(
      {
        asset_id: asset.id,
        event_type: "Issued",
        event_date: issueDate,
        to_employee_id: resolvedEmployeeId,
        to_custodian_id: resolvedCustodianFields.custodian_id,
        to_custodian_type: resolvedCustodianFields.custodian_type,
        ...resolvedCustodianFields,
        issued_item_id: issued.id,
        daybook_id: null,
        daybook_item_id: null,
        location_scope: locationScope,
        notes: eventNotes,
        performed_by: actorLabel,
      },
      { transaction },
    );

    return {
      status: "imported",
      message: "Serialized issued row migrated",
      stock_id: resolved.stock.id,
      item_master_id: resolved.item_master_id || null,
      employee_emp_id: resolvedEmployeeId,
      asset_id: asset.id,
      issued_item_id: issued.id,
      location_scope: locationScope,
    };
  }

  async _processConsumableRow({
    row,
    options,
    dryRun = false,
    transaction = null,
    actorLabel = "System Migration",
  }) {
    const quantity = IssuedMigrationService.toInteger(row.quantity);
    if (!quantity || quantity <= 0) {
      throw new Error("quantity must be a whole number greater than 0");
    }

    if (!dryRun && !transaction) {
      throw new Error("transaction is required in execute mode");
    }

    const resolved = await this._resolveCommon({
      row,
      options,
      transaction,
      writeMode: !dryRun,
    });
    const resolvedCustodian = resolved.custodian;
    const resolvedEmployeeId = resolvedCustodian?.employeeId ?? null;
    const resolvedCustodianFields = toCustodianFields(resolvedCustodian);
    const locationScope = resolved.location_scope || null;

    if (dryRun) {
      return {
        status: "ok",
        message: "Will create consumable issue",
        stock_id: resolved.stock?.id || null,
        item_master_id: resolved.item_master_id || null,
        employee_emp_id: resolvedEmployeeId,
        quantity,
        location_scope: locationScope,
        will_create_stock: !!resolved.willCreateStock,
      };
    }

    if (IssuedMigrationService.toBool(options.adjustStock, false)) {
      const stock = await Stock.findOne({
        where: { id: resolved.stock.id, is_active: true },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!stock) {
        throw new Error(`Stock not found during adjustment: ${resolved.stock.id}`);
      }
      if (stock.quantity < quantity) {
        throw new Error(
          `Insufficient stock for adjustment. stock_id ${stock.id}, quantity ${stock.quantity}`,
        );
      }
      await stock.update({ quantity: stock.quantity - quantity }, { transaction });
    }

    const issued = await IssuedItem.create(
      {
        employee_id: resolvedEmployeeId,
        ...resolvedCustodianFields,
        item_id: resolved.stock.id,
        item_master_id: resolved.item_master_id || null,
        quantity,
        sku_unit: resolved.sku_unit || resolved.stock.sku_unit || "Unit",
        date: resolved.issueDate || new Date(),
        location_scope: locationScope,
        requisition_url: null,
        requisition_id: null,
        requisition_item_id: null,
        source: "MIGRATION",
      },
      { transaction },
    );

    if (IssuedMigrationService.toBool(options.adjustStock, false)) {
      await logStockMovement(
        {
          itemMasterId: resolved.item_master_id,
          stockId: resolved.stock.id,
          movementType: "ISSUE_OUT",
          qty: -Math.abs(quantity),
          skuUnit: resolved.sku_unit || resolved.stock.sku_unit || "Unit",
          movementAt: resolved.issueDate || new Date(),
          referenceType: "IssuedItem",
          referenceId: issued.id,
          toEmployeeId: resolvedEmployeeId,
          performedBy: actorLabel,
          remarks: "Issued migration (consumable)",
          locationScope,
          metadata: {
            source: SOURCE_FLAG,
            row_no: row.row_no,
            item_no: row.item_no,
          },
        },
        { transaction },
      );
    }

    return {
      status: "imported",
      message: "Consumable issued row migrated",
      stock_id: resolved.stock.id,
      item_master_id: resolved.item_master_id || null,
      employee_emp_id: resolvedEmployeeId,
      quantity,
      issued_item_id: issued.id,
      location_scope: locationScope,
    };
  }

  async _processRows({
    rows,
    type,
    options,
    dryRun,
    sheetName = null,
    transaction = null,
    actorLabel = "System Migration",
  }) {
    const details = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      const inputEmployeeEmpId =
        IssuedMigrationService.toInteger(row.employee_emp_id);
      if (inputEmployeeEmpId == null) {
        failed += 1;
        details.push({
          sheet:
            row.sheet_name ||
            sheetName ||
            (type === "serialized" ? "assets_issued" : "consumables_issued"),
          row_no: row.row_no,
          item_no: row.item_no,
          input_employee_emp_id: row.employee_emp_id ?? null,
          status: "failed",
          message: "employee_emp_id is required for issued migration",
        });
        continue;
      }

      try {
        const data =
          type === "serialized"
            ? await this._processSerializedRow({
              row,
              options,
              dryRun,
              transaction,
              actorLabel,
            })
            : await this._processConsumableRow({
              row,
              options,
              dryRun,
              transaction,
              actorLabel,
            });

        if (data.status === "imported") imported += 1;
        else if (data.status === "skipped") skipped += 1;

        details.push({
          sheet:
            row.sheet_name ||
            sheetName ||
            (type === "serialized" ? "assets_issued" : "consumables_issued"),
          row_no: row.row_no,
          item_no: row.item_no,
          input_employee_emp_id: row.employee_emp_id ?? null,
          ...data,
        });
      } catch (error) {
        failed += 1;
        details.push({
          sheet:
            row.sheet_name ||
            sheetName ||
            (type === "serialized" ? "assets_issued" : "consumables_issued"),
          row_no: row.row_no,
          item_no: row.item_no,
          input_employee_emp_id: row.employee_emp_id ?? null,
          status: "failed",
          message: error.message || "Unknown error",
        });
      }
    }

    return { details, imported, skipped, failed };
  }

  async validate({
    assetsRows = [],
    consumableRows = [],
    invalidEmployeeRows = [],
    options = {},
    sheetLabels = {},
  }, context = {}) {
    const importContext = this._buildImportContext(context);
    const normalizedAssets = this._buildSheetRows(assetsRows);
    const normalizedConsumables = this._buildSheetRows(consumableRows);
    const invalidEmployeeDetails = (invalidEmployeeRows || []).map((row) => ({
      sheet:
        row.sheet_name ||
        sheetLabels.serialized ||
        sheetLabels.consumable ||
        "issued_items",
      row_no: row.row_no,
      item_no: row.row_no,
      input_employee_emp_id: row.employee_emp_id ?? null,
      status: "failed",
      message:
        row.employee_error ||
        "employee_emp_id is required when employee_name or division is provided",
    }));

    const serializedResult = await this._processRows({
      rows: normalizedAssets,
      type: "serialized",
      options,
      dryRun: true,
      sheetName: sheetLabels.serialized || null,
      actorLabel: importContext.performed_by,
    });
    const consumableResult = await this._processRows({
      rows: normalizedConsumables,
      type: "consumable",
      options,
      dryRun: true,
      sheetName: sheetLabels.consumable || null,
      actorLabel: importContext.performed_by,
    });

    const allDetails = [
      ...invalidEmployeeDetails,
      ...serializedResult.details,
      ...consumableResult.details,
    ];
    const failed =
      invalidEmployeeDetails.length +
      serializedResult.failed +
      consumableResult.failed;

    return {
      success: failed === 0,
      mode: "validate",
      import_context: importContext,
      summary: {
        total_rows:
          normalizedAssets.length +
          normalizedConsumables.length +
          invalidEmployeeRows.length,
        assets_rows: normalizedAssets.length,
        consumables_rows: normalizedConsumables.length,
        ready_rows:
          serializedResult.details.filter((d) => d.status === "ok").length +
          consumableResult.details.filter((d) => d.status === "ok").length,
        failed_rows: failed,
      },
      resolved_locations: this._collectResolvedLocations(allDetails),
      details: allDetails,
    };
  }

  async execute({
    assetsRows = [],
    consumableRows = [],
    invalidEmployeeRows = [],
    options = {},
    sheetLabels = {},
  }, context = {}) {
    const importContext = this._buildImportContext(context);
    const normalizedAssets = this._buildSheetRows(assetsRows);
    const normalizedConsumables = this._buildSheetRows(consumableRows);
    const invalidEmployeeDetails = (invalidEmployeeRows || []).map((row) => ({
      sheet:
        row.sheet_name ||
        sheetLabels.serialized ||
        sheetLabels.consumable ||
        "issued_items",
      row_no: row.row_no,
      item_no: row.row_no,
      input_employee_emp_id: row.employee_emp_id ?? null,
      status: "failed",
      message:
        row.employee_error ||
        "employee_emp_id is required when employee_name or division is provided",
    }));

    const precheckSerialized = await this._processRows({
      rows: normalizedAssets,
      type: "serialized",
      options,
      dryRun: true,
      sheetName: sheetLabels.serialized || null,
      actorLabel: importContext.performed_by,
    });
    const precheckConsumable = await this._processRows({
      rows: normalizedConsumables,
      type: "consumable",
      options,
      dryRun: true,
      sheetName: sheetLabels.consumable || null,
      actorLabel: importContext.performed_by,
    });

    const precheckDetails = [
      ...invalidEmployeeDetails,
      ...precheckSerialized.details,
      ...precheckConsumable.details,
    ];
    const precheckFailed =
      invalidEmployeeDetails.length +
      precheckSerialized.failed +
      precheckConsumable.failed;
    const totalRows =
      normalizedAssets.length +
      normalizedConsumables.length +
      invalidEmployeeRows.length;

    if (precheckFailed > 0) {
      return {
        success: false,
        mode: "execute",
        import_context: importContext,
        summary: {
          total_rows: totalRows,
          assets_rows: normalizedAssets.length,
          consumables_rows: normalizedConsumables.length,
          imported_rows: 0,
          skipped_rows: 0,
          failed_rows: precheckFailed,
        },
        resolved_locations: this._collectResolvedLocations(precheckDetails),
        details: precheckDetails,
      };
    }

    const transaction = await sequelize.transaction();
    try {
      const serializedResult = await this._processRows({
        rows: normalizedAssets,
        type: "serialized",
        options,
        dryRun: false,
        sheetName: sheetLabels.serialized || null,
        transaction,
        actorLabel: importContext.performed_by,
      });
      const consumableResult = await this._processRows({
        rows: normalizedConsumables,
        type: "consumable",
        options,
        dryRun: false,
        sheetName: sheetLabels.consumable || null,
        transaction,
        actorLabel: importContext.performed_by,
      });

      const allDetails = [...serializedResult.details, ...consumableResult.details];
      const failed = serializedResult.failed + consumableResult.failed;
      const imported = serializedResult.imported + consumableResult.imported;
      const skipped = serializedResult.skipped + consumableResult.skipped;

      if (failed > 0) {
        await transaction.rollback();
        return {
          success: false,
          mode: "execute",
          import_context: importContext,
          summary: {
            total_rows: totalRows,
            assets_rows: normalizedAssets.length,
            consumables_rows: normalizedConsumables.length,
            imported_rows: 0,
            skipped_rows: skipped,
            failed_rows: failed,
          },
          resolved_locations: this._collectResolvedLocations(allDetails),
          details: allDetails.map((row) =>
            row.status === "imported"
              ? {
                ...row,
                status: "rolled_back",
                message: `${row.message} (rolled back due to batch failure)`,
              }
              : row,
          ),
        };
      }

      await transaction.commit();

      return {
        success: true,
        mode: "execute",
        import_context: importContext,
        summary: {
          total_rows: totalRows,
          assets_rows: normalizedAssets.length,
          consumables_rows: normalizedConsumables.length,
          imported_rows: imported,
          skipped_rows: skipped,
          failed_rows: 0,
        },
        resolved_locations: this._collectResolvedLocations(allDetails),
        details: allDetails,
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  }
}

module.exports = { IssuedMigrationService, SOURCE_FLAG };
