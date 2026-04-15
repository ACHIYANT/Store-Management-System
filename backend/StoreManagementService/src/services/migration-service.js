const {
  sequelize,
  Stock,
  ItemCategory,
  Asset,
  AssetEvent,
  DayBookItem,
  DayBookItemSerial,
  Employee,
  Custodian,
} = require("../models");
const { Op } = require("sequelize");
const { normalizeSkuUnit } = require("../utils/sku-units");
const { ensureItemMaster } = require("./item-master-service");
const { logStockMovement } = require("./stock-movement-service");
const { normalizeLocationScope } = require("../utils/location-scope");
const { buildMigrationActorLabel } = require("../utils/migration-api-utils");

const MIGRATION_DAYBOOK_ID = 107; // <-- replace with yours
const OPENING_VENDOR_ID = 55; // replace with your actual Opening Vendor ID
const BASE_AFFECTED_TABLES = ["ItemMasters", "Stocks", "StockMovements"];
const SERIALIZED_AFFECTED_TABLES = [
  ...BASE_AFFECTED_TABLES,
  "DayBookItems",
  "DayBookItemSerials",
  "Assets",
  "AssetEvents",
];

class MigrationService {
  constructor() {
    this._cachedImplicitLocationScope = undefined;
  }

  resolveSkuUnit(value) {
    return normalizeSkuUnit(value ?? "Unit");
  }

  getRowNo(row = {}, fallback = 0) {
    const fromPayload = Number(row.__row_no || row.row_no);
    if (Number.isInteger(fromPayload) && fromPayload > 0) return fromPayload;
    return fallback > 0 ? fallback : 0;
  }

  requireText(value, fieldName, rowNo) {
    const clean = String(value ?? "").trim();
    if (!clean) {
      throw new Error(`Row ${rowNo}: ${fieldName} is required`);
    }
    return clean;
  }

  requirePositiveNumber(value, fieldName, rowNo) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      throw new Error(`Row ${rowNo}: ${fieldName} must be a positive number`);
    }
    return num;
  }

  requireValidDate(value, fieldName, rowNo) {
    const dateValue = this.parseExcelDate(value);
    if (!dateValue) {
      throw new Error(`Row ${rowNo}: ${fieldName} is required and must be a valid date`);
    }
    return dateValue;
  }

  generateAssetTag(categoryName, year, daybookItemId, seq) {
    const CAT = categoryName
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 3)
      .toUpperCase()
      .padEnd(3, "X");

    return `${CAT}-${year}-${daybookItemId}-${String(seq).padStart(3, "0")}`;
  }

  parseAssetTagSequence(assetTag, daybookItemId) {
    const match = String(assetTag || "").match(
      new RegExp(`-${daybookItemId}-(\\d+)$`),
    );
    const seq = Number(match?.[1] || 0);
    return Number.isInteger(seq) && seq > 0 ? seq : 0;
  }

  async getNextAssetTagSequence(daybookItemId, transaction) {
    const [serialRows, assetRows] = await Promise.all([
      DayBookItemSerial.findAll({
        attributes: ["asset_tag"],
        where: { daybook_item_id: daybookItemId },
        raw: true,
        transaction,
      }),
      Asset.findAll({
        attributes: ["asset_tag"],
        where: { daybook_item_id: daybookItemId },
        raw: true,
        transaction,
      }),
    ]);

    const maxSeq = [...serialRows, ...assetRows].reduce((max, row) => {
      return Math.max(
        max,
        this.parseAssetTagSequence(row?.asset_tag, daybookItemId),
      );
    }, 0);

    return maxSeq + 1;
  }

  parseExcelDate(value) {
    if (!value) return null;

    // Excel JS Date
    if (value instanceof Date) return value;

    // Excel numeric date
    if (typeof value === "number") {
      return new Date(Math.round((value - 25569) * 86400 * 1000));
    }

    // String date
    if (typeof value === "string") {
      const parsed = new Date(value);
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  async getImplicitSingleLocationScope(transaction) {
    if (this._cachedImplicitLocationScope !== undefined) {
      return this._cachedImplicitLocationScope;
    }

    const [employeeRows, custodianRows] = await Promise.all([
      Employee.findAll({
        attributes: [
          [sequelize.fn("DISTINCT", sequelize.col("office_location")), "office_location"],
        ],
        where: {
          office_location: { [Op.ne]: null },
        },
        raw: true,
        transaction,
      }),
      Custodian.findAll({
        attributes: [[sequelize.fn("DISTINCT", sequelize.col("location")), "location"]],
        where: {
          location: { [Op.ne]: null },
        },
        raw: true,
        transaction,
      }),
    ]);

    const scopes = [
      ...new Set(
        [...employeeRows, ...custodianRows]
          .map((row) =>
            normalizeLocationScope(row.office_location || row.location || null),
          )
          .filter(Boolean),
      ),
    ];

    this._cachedImplicitLocationScope = scopes.length === 1 ? scopes[0] : null;
    return this._cachedImplicitLocationScope;
  }

  async resolveGroupLocationScope(records = [], stock = null, transaction = null) {
    const explicitScopes = [
      ...new Set(
        (records || [])
          .flatMap((row) => [
            row?.location_scope,
            row?.location,
            row?.office_location,
            row?.store_location,
          ])
          .map((value) => normalizeLocationScope(value))
          .filter(Boolean),
      ),
    ];

    const stockScope = normalizeLocationScope(stock?.location_scope || null);
    if (stockScope && !explicitScopes.includes(stockScope)) {
      explicitScopes.push(stockScope);
    }

    if (explicitScopes.length > 1) {
      throw new Error(
        `Rows ${records.map((row) => this.getRowNo(row, 0)).filter(Boolean).join(", ")} contain multiple locations. Opening stock groups must stay within a single location.`,
      );
    }

    if (explicitScopes.length === 1) {
      return explicitScopes[0];
    }

    const implicitScope = await this.getImplicitSingleLocationScope(transaction);
    if (implicitScope) {
      return implicitScope;
    }

    throw new Error(
      `Rows ${records.map((row) => this.getRowNo(row, 0)).filter(Boolean).join(", ")} need location_scope/location because the system has multiple locations.`,
    );
  }

  getWouldAffectTables(serializedRequired = false) {
    return serializedRequired
      ? [...SERIALIZED_AFFECTED_TABLES]
      : [...BASE_AFFECTED_TABLES];
  }

  buildImportContext(context = {}) {
    return {
      performed_by:
        context?.actorLabel ||
        buildMigrationActorLabel(context?.actorMeta?.requested_by || context),
    };
  }

  async buildLocationSummary(rows = [], transaction = null) {
    const grouped = {};

    for (const row of rows || []) {
      const itemName = String(row?.item_name || "").trim();
      const categoryName = String(row?.category_name || "").trim();
      const skuUnit = this.resolveSkuUnit(row?.sku_unit ?? row?.unit ?? row?.uom);
      if (!itemName || !categoryName) continue;
      const key = `${itemName}__${categoryName}__${skuUnit}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }

    const summaries = [];
    for (const key of Object.keys(grouped)) {
      const records = grouped[key];
      const sample = records[0] || {};
      const skuUnit = this.resolveSkuUnit(sample.sku_unit ?? sample.unit ?? sample.uom);
      const sourceRows = Array.from(
        new Set(records.map((entry) => this.getRowNo(entry, 0)).filter((n) => n > 0)),
      ).sort((a, b) => a - b);

      const stock = await Stock.findOne({
        where: {
          item_name: String(sample.item_name || "").trim(),
          sku_unit: skuUnit,
          is_active: true,
        },
        attributes: ["id", "location_scope"],
        transaction: transaction || undefined,
      });

      try {
        const locationScope = await this.resolveGroupLocationScope(
          records,
          stock,
          transaction,
        );
        summaries.push({
          group_key: key,
          item_name: sample.item_name,
          category_name: sample.category_name,
          sku_unit: skuUnit,
          stock_id: stock?.id || null,
          source_rows: sourceRows,
          location_scope: locationScope,
          status: "ok",
        });
      } catch (error) {
        summaries.push({
          group_key: key,
          item_name: sample.item_name,
          category_name: sample.category_name,
          sku_unit: skuUnit,
          stock_id: stock?.id || null,
          source_rows: sourceRows,
          location_scope: null,
          status: "failed",
          message: error?.message || "Location resolution failed",
        });
      }
    }

    return summaries;
  }

  initAffectedAccumulator() {
    return {
      itemMasters: new Set(),
      stocksCreated: new Set(),
      stocksUpdated: new Set(),
      stocksTouched: new Set(),
      stockMovements: new Set(),
      dayBookItemsCreated: new Set(),
      dayBookItemsUpdated: new Set(),
      dayBookItemsTouched: new Set(),
      dayBookItemSerialsCreated: new Set(),
      assetsCreated: new Set(),
      assetEventsCreated: new Set(),
    };
  }

  toSortedNumberArray(setObject) {
    return Array.from(setObject || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .sort((a, b) => a - b);
  }

  buildAffectedTablesPayload(affected = this.initAffectedAccumulator()) {
    return {
      ItemMasters: {
        touched_row_ids: this.toSortedNumberArray(affected.itemMasters),
      },
      Stocks: {
        created_row_ids: this.toSortedNumberArray(affected.stocksCreated),
        updated_row_ids: this.toSortedNumberArray(affected.stocksUpdated),
        touched_row_ids: this.toSortedNumberArray(affected.stocksTouched),
      },
      StockMovements: {
        inserted_row_ids: this.toSortedNumberArray(affected.stockMovements),
      },
      DayBookItems: {
        created_row_ids: this.toSortedNumberArray(affected.dayBookItemsCreated),
        updated_row_ids: this.toSortedNumberArray(affected.dayBookItemsUpdated),
        touched_row_ids: this.toSortedNumberArray(affected.dayBookItemsTouched),
      },
      DayBookItemSerials: {
        inserted_row_ids: this.toSortedNumberArray(
          affected.dayBookItemSerialsCreated,
        ),
      },
      Assets: {
        inserted_row_ids: this.toSortedNumberArray(affected.assetsCreated),
      },
      AssetEvents: {
        inserted_row_ids: this.toSortedNumberArray(affected.assetEventsCreated),
      },
    };
  }

  async validate(rows = [], context = {}) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Excel file is empty");
    }

    const categoryCache = new Map();
    const serialSeenInFile = new Map();
    const details = [];
    const wouldAffectTableSet = new Set();
    let readyRows = 0;
    let failedRows = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const sourceRow = rows[index] || {};
      const rowNo = this.getRowNo(sourceRow, index + 2);

      try {
        const itemName = this.requireText(
          sourceRow.item_name,
          "item_name",
          rowNo,
        );
        const categoryName = this.requireText(
          sourceRow.category_name,
          "category_name",
          rowNo,
        );
        const quantity = this.requirePositiveNumber(
          sourceRow.quantity,
          "quantity",
          rowNo,
        );
        const skuUnit = this.resolveSkuUnit(
          sourceRow.sku_unit ?? sourceRow.unit ?? sourceRow.uom,
        );
        const purchasedAt = this.requireValidDate(
          sourceRow.purchased_at,
          "purchased_at",
          rowNo,
        );
        const warrantyExpiry = this.requireValidDate(
          sourceRow.warranty_expiry,
          "warranty_expiry",
          rowNo,
        );

        if (warrantyExpiry < purchasedAt) {
          throw new Error(
            `Row ${rowNo}: warranty_expiry cannot be before purchased_at`,
          );
        }

        const categoryKey = categoryName.toLowerCase();
        let category = categoryCache.get(categoryKey);
        if (!category) {
          category = await ItemCategory.findOne({
            where: { category_name: categoryName },
          });
          categoryCache.set(categoryKey, category || null);
        }
        if (!category) {
          throw new Error(`Row ${rowNo}: category not found '${categoryName}'`);
        }

        const rawSerial = String(sourceRow.serial_number ?? "").trim();
        if (category.serialized_required) {
          if (Number(quantity) !== 1) {
            throw new Error(
              `Row ${rowNo}: quantity must be 1 for serialized category items`,
            );
          }
          if (!rawSerial) {
            throw new Error(
              `Row ${rowNo}: serial_number is required for serialized category items`,
            );
          }

          const serialKey = rawSerial.toUpperCase();
          if (serialSeenInFile.has(serialKey)) {
            throw new Error(
              `Row ${rowNo}: duplicate serial_number '${rawSerial}' also found at row ${serialSeenInFile.get(serialKey)}`,
            );
          }
          serialSeenInFile.set(serialKey, rowNo);

          const existing = await Asset.findOne({
            where: { serial_number: rawSerial, is_active: true },
            attributes: ["id"],
          });
          if (existing) {
            throw new Error(
              `Row ${rowNo}: duplicate serial_number '${rawSerial}' already exists in system`,
            );
          }

          const existingInDayBookSerials = await DayBookItemSerial.findOne({
            where: { serial_number: rawSerial },
            attributes: ["id"],
          });
          if (existingInDayBookSerials) {
            throw new Error(
              `Row ${rowNo}: duplicate serial_number '${rawSerial}' already exists in DayBookItemSerials`,
            );
          }
        }

        readyRows += 1;
        const serializedRequired = Boolean(category.serialized_required);
        const wouldAffectTables = this.getWouldAffectTables(serializedRequired);
        for (const tableName of wouldAffectTables) {
          wouldAffectTableSet.add(tableName);
        }

        details.push({
          row_no: rowNo,
          status: "ok",
          message: "Ready to import",
          item_name: itemName,
          category_name: categoryName,
          quantity,
          sku_unit: skuUnit,
          serialized_required: serializedRequired,
          would_affect_tables: wouldAffectTables,
        });
      } catch (error) {
        failedRows += 1;
        details.push({
          row_no: rowNo,
          status: "failed",
          message: error?.message || "Validation failed",
          item_name: sourceRow.item_name || null,
          category_name: sourceRow.category_name || null,
        });
      }
    }

    const locationSummary = await this.buildLocationSummary(rows);
    return {
      success: failedRows === 0,
      mode: "validate",
      summary: {
        total_rows: rows.length,
        ready_rows: readyRows,
        failed_rows: failedRows,
      },
      import_context: this.buildImportContext(context),
      location_summary: locationSummary,
      resolved_locations: [
        ...new Set(
          locationSummary
            .map((entry) => normalizeLocationScope(entry?.location_scope || null))
            .filter(Boolean),
        ),
      ],
      affected_tables: Array.from(wouldAffectTableSet),
      details,
    };
  }

  async execute(rows = [], context = {}) {
    return this.migrate(rows, context);
  }

  async migrate(rows, context = {}) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("Excel file is empty");
    }

    rows.forEach((rawRow, index) => {
      const row = rawRow || {};
      const rowNo = this.getRowNo(row, index + 2);

      row.item_name = this.requireText(row.item_name, "item_name", rowNo);
      row.category_name = this.requireText(row.category_name, "category_name", rowNo);
      row.quantity = this.requirePositiveNumber(row.quantity, "quantity", rowNo);
      row.sku_unit = this.resolveSkuUnit(row.sku_unit ?? row.unit ?? row.uom);
      row.purchased_at = this.requireValidDate(row.purchased_at, "purchased_at", rowNo);
      row.warranty_expiry = this.requireValidDate(
        row.warranty_expiry,
        "warranty_expiry",
        rowNo,
      );

      if (row.warranty_expiry < row.purchased_at) {
        throw new Error(
          `Row ${rowNo}: warranty_expiry cannot be before purchased_at`,
        );
      }
    });

    const grouped = {};
    const details = [];
    const affected = this.initAffectedAccumulator();
    let serializedGroups = 0;
    let nonSerializedGroups = 0;

    // Group by item_name + category
    for (const row of rows) {
      const key = `${row.item_name}__${row.category_name}__${row.sku_unit}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }

    const actorLabel = this.buildImportContext(context).performed_by;

    return sequelize.transaction(async (transaction) => {
      for (const key of Object.keys(grouped)) {
        const records = grouped[key];
        const sample = records[0];
        const skuUnit = sample.sku_unit;
        const sourceRows = Array.from(
          new Set(records.map((entry) => this.getRowNo(entry, 0)).filter((n) => n > 0)),
        ).sort((a, b) => a - b);

        const category = await ItemCategory.findOne({
          where: { category_name: sample.category_name },
          transaction,
        });
        if (!category)
          throw new Error(`Category not found: ${sample.category_name}`);

        const serializedRequired = Boolean(category.serialized_required);
        if (serializedRequired) {
          const serialToRowNo = new Map();
          for (const record of records) {
            const rowNo = this.getRowNo(record, 0);
            const rowQty = Number(record.quantity || 0);
            if (rowQty !== 1) {
              throw new Error(
                `Row ${rowNo}: quantity must be 1 for serialized category items`,
              );
            }
            const serial = String(record.serial_number || "").trim();
            if (!serial) {
              throw new Error(
                `Row ${rowNo}: serial_number is required for serialized category items`,
              );
            }
            const serialKey = serial.toUpperCase();
            if (serialToRowNo.has(serialKey)) {
              throw new Error(
                `Row ${rowNo}: duplicate serial_number '${serial}' also found at row ${serialToRowNo.get(serialKey)}`,
              );
            }
            serialToRowNo.set(serialKey, rowNo);
          }

          const serials = records.map((record) =>
            String(record.serial_number || "").trim(),
          );
          if (serials.length) {
            const existingAssets = await Asset.findAll({
              where: {
                serial_number: serials,
                is_active: true,
              },
              attributes: ["id", "serial_number"],
              transaction,
            });
            if (existingAssets.length > 0) {
              const first = existingAssets[0];
              const firstSerial = String(first.serial_number || "");
              const rowNo = serialToRowNo.get(firstSerial.toUpperCase()) || 0;
              throw new Error(
                `Row ${rowNo}: duplicate serial_number '${firstSerial}' already exists in system`,
              );
            }

            const existingDayBookSerials = await DayBookItemSerial.findAll({
              where: {
                serial_number: serials,
              },
              attributes: ["id", "serial_number", "daybook_item_id"],
              transaction,
            });
            if (existingDayBookSerials.length > 0) {
              const firstSerialRow = existingDayBookSerials[0];
              const firstSerial = String(firstSerialRow.serial_number || "");
              const rowNo = serialToRowNo.get(firstSerial.toUpperCase()) || 0;
              throw new Error(
                `Row ${rowNo}: duplicate serial_number '${firstSerial}' already exists in DayBookItemSerials`,
              );
            }
          }
        }

        const itemMaster = await ensureItemMaster({
          itemCategoryId: category.id,
          skuUnit,
          itemName: sample.item_name,
          aliasText: sample.item_name,
          transaction,
        });
        const itemMasterId = Number(itemMaster?.id || 0) || null;
        if (itemMasterId) affected.itemMasters.add(itemMasterId);

        // ✅ Always create/update Stock
        const totalQty = records.reduce(
          (sum, r) => sum + Number(r.quantity || 0),
          0,
        );
        const groupDetail = {
          group_key: key,
          item_name: sample.item_name,
          category_name: sample.category_name,
          sku_unit: skuUnit,
          source_rows: sourceRows,
          serialized_required: serializedRequired,
          item_master_id: itemMasterId,
          total_quantity: totalQty,
          would_affect_tables: this.getWouldAffectTables(serializedRequired),
        };

        let stock = await Stock.findOne({
          where: { item_name: sample.item_name, sku_unit: skuUnit, is_active: true },
          transaction,
        });
        const locationScope = await this.resolveGroupLocationScope(
          records,
          stock,
          transaction,
        );
        const stockQtyBefore = Number(stock?.quantity || 0);
        let stockAction = "created";
        let stockQtyAfter = totalQty;

        if (!stock) {
          stock = await Stock.create(
            {
              item_name: sample.item_name,
              quantity: totalQty,
              sku_unit: skuUnit,
              rate: 0,
              gst_rate: 0,
              amount: 0,
              item_category_id: category.id,
              item_master_id: itemMasterId,
              source: "MIGRATION",
              location_scope: locationScope,
            },
            { transaction },
          );
          affected.stocksCreated.add(stock.id);
          affected.stocksTouched.add(stock.id);
        } else {
          stockAction = "updated";
          const nextQty = Number(stock.quantity || 0) + totalQty;
          stockQtyAfter = nextQty;
          await stock.update(
            {
              quantity: nextQty,
              item_master_id: stock.item_master_id || itemMasterId,
              location_scope: stock.location_scope || locationScope,
            },
            { transaction },
          );
          stock.location_scope = stock.location_scope || locationScope;
          affected.stocksUpdated.add(stock.id);
          affected.stocksTouched.add(stock.id);
        }

        groupDetail.stock = {
          action: stockAction,
          stock_id: stock.id,
          quantity_before: stockQtyBefore,
          quantity_after: stockQtyAfter,
        };
        groupDetail.location_scope = locationScope;

        const stockMovement = await logStockMovement(
          {
            itemMasterId: itemMasterId || stock.item_master_id,
            stockId: stock.id,
            movementType: "OPENING_BALANCE",
            qty: totalQty,
            skuUnit,
            movementAt: new Date(),
            referenceType: "OpeningMigration",
            referenceId: stock.id,
            performedBy: actorLabel,
            remarks: "Opening stock migration import",
            locationScope,
          },
          { transaction },
        );
        if (stockMovement?.id) affected.stockMovements.add(stockMovement.id);
        groupDetail.stock_movement = {
          movement_id: stockMovement?.id || null,
          movement_type: "OPENING_BALANCE",
          qty: totalQty,
        };

        if (serializedRequired) {
          serializedGroups += 1;
          // ✅ Check if DayBookItem already exists for this migration
          let daybookItem = await DayBookItem.findOne({
            where: {
              daybook_id: MIGRATION_DAYBOOK_ID,
              item_name: sample.item_name,
              item_category_id: category.id,
            },
            transaction,
          });
          let dayBookItemAction = "created";
          const dayBookQtyBefore = Number(daybookItem?.quantity || 0);

          if (!daybookItem) {
            daybookItem = await DayBookItem.create(
              {
                daybook_id: MIGRATION_DAYBOOK_ID,
                item_name: sample.item_name,
                item_category_id: category.id,
                quantity: 0,
                sku_unit: skuUnit,
                rate: 0,
                gst_type: "IGST",
                gst_rate: 0,
                amount: 0,
                stock_id: stock.id,
                item_master_id: itemMasterId,
              },
              { transaction },
            );
            affected.dayBookItemsCreated.add(daybookItem.id);
            affected.dayBookItemsTouched.add(daybookItem.id);
          } else {
            dayBookItemAction = "updated";
            // Keep metadata in sync; quantity will be aligned to active asset count below.
            await daybookItem.update(
              {
                sku_unit: skuUnit,
                item_master_id: daybookItem.item_master_id || itemMasterId,
              },
              { transaction },
            );
            affected.dayBookItemsUpdated.add(daybookItem.id);
            affected.dayBookItemsTouched.add(daybookItem.id);
          }

          groupDetail.created_assets = [];

          let seq = await this.getNextAssetTagSequence(daybookItem.id, transaction);

          for (const r of records) {
            const rowNo = this.getRowNo(r, 0);
            const purchasedDate = r.purchased_at;
            const year = purchasedDate.getFullYear();

            const assetTag = this.generateAssetTag(
              category.category_name,
              year,
              daybookItem.id,
              seq++,
            );

            const warrantyDate = r.warranty_expiry;
            const dayBookItemSerial = await DayBookItemSerial.create(
              {
                daybook_item_id: daybookItem.id,
                serial_number: r.serial_number,
                purchased_at: purchasedDate,
                warranty_expiry: warrantyDate,
                asset_tag: assetTag,
                source: "MIGRATION",
                migrated_at: new Date(),
              },
              { transaction },
            );
            if (dayBookItemSerial?.id) {
              affected.dayBookItemSerialsCreated.add(dayBookItemSerial.id);
            }

            const asset = await Asset.create(
              {
                serial_number: r.serial_number,
                asset_tag: assetTag,
                stock_id: stock.id,
                item_category_id: category.id,
                item_master_id: itemMasterId,
                daybook_id: MIGRATION_DAYBOOK_ID,
                daybook_item_id: daybookItem.id,
                vendor_id: OPENING_VENDOR_ID, // ✅ add this
                purchased_at: purchasedDate, // ✅ fixed date
                warranty_expiry: warrantyDate, // ✅ fixed date
                status: "InStore",
                location_scope: locationScope,
                notes: "MIGRATED_OPENING_STOCK", // ✅ uniform tag
              },
              { transaction },
            );
            if (asset?.id) affected.assetsCreated.add(asset.id);

            const assetEvent = await AssetEvent.create(
              {
                asset_id: asset.id,
                event_type: "OpeningBalance",
                event_date: new Date(),
                daybook_id: MIGRATION_DAYBOOK_ID, // ✅ add
                daybook_item_id: daybookItem.id, // ✅ add
                location_scope: locationScope,
                notes: "MIGRATED_OPENING_STOCK", // ✅ uniform
                performed_by: actorLabel,
              },
              { transaction },
            );
            if (assetEvent?.id) affected.assetEventsCreated.add(assetEvent.id);

            groupDetail.created_assets.push({
              row_no: rowNo,
              serial_number: r.serial_number,
              daybook_item_serial_id: dayBookItemSerial?.id || null,
              asset_id: asset.id,
              asset_tag: asset.asset_tag,
              asset_event_id: assetEvent?.id || null,
            });
          }

          const dayBookQtyAfter = await Asset.count({
            where: {
              daybook_item_id: daybookItem.id,
              is_active: true,
            },
            transaction,
          });
          await daybookItem.update(
            {
              quantity: Number(dayBookQtyAfter || 0),
            },
            { transaction },
          );

          groupDetail.daybook_item = {
            action: dayBookItemAction,
            daybook_item_id: daybookItem.id,
            quantity_before: dayBookQtyBefore,
            quantity_after: Number(dayBookQtyAfter || 0),
          };
        } else {
          nonSerializedGroups += 1;
        }

        details.push(groupDetail);
      }

      return {
        success: true,
        mode: "execute",
        import_context: this.buildImportContext(context),
        summary: {
          total_rows: rows.length,
          grouped_items: Object.keys(grouped).length,
          serialized_groups: serializedGroups,
          non_serialized_groups: nonSerializedGroups,
        },
        resolved_locations: [
          ...new Set(
            details
              .map((entry) => normalizeLocationScope(entry?.location_scope || null))
              .filter(Boolean),
          ),
        ],
        affected_tables: this.buildAffectedTablesPayload(affected),
        details,
      };
    });
  }
}

module.exports = { MigrationService };
