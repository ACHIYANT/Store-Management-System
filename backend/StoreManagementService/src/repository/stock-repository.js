const {
  DayBookItem,
  DayBook,
  ItemCategory,
  Stock,
  sequelize,
  ItemCategoryGroup,
  ItemCategoryHead,
} = require("../models"); // Import Sequelize models
const { ensureItemMaster } = require("../services/item-master-service");
const { logStockMovement } = require("../services/stock-movement-service");
const {
  assertActorCanAccessLocation,
  buildLocationScopeWhere,
  collectActorLocationScopes,
} = require("../utils/location-scope");

const { Op } = require("sequelize");
const {
  decodeCursor,
  encodeCursor,
  normalizeLimit,
  applyStringIdAscCursor,
} = require("../utils/cursor-pagination");

const STOCK_SOURCES = new Set(["DAYBOOK", "MIGRATION"]);
const normalizeStockSource = (value) => {
  if (!value) return null;
  const raw = String(value).trim().toUpperCase();
  return STOCK_SOURCES.has(raw) ? raw : null;
};

const buildInStoreAssetCountSql = (stockAlias = "Stock") => `(
  SELECT COUNT(*)
  FROM Assets a
  WHERE a.stock_id = ${stockAlias}.id
    AND a.status = 'InStore'
    AND a.is_active = 1
)`;

const normalizeSerializedAvailabilityRow = (row = {}) => {
  const serializedRequired =
    Number(row["ItemCategory.serialized_required"] || row.serialized_required || 0) === 1 ||
    row["ItemCategory.serialized_required"] === true ||
    row.serialized_required === true;
  const availableQuantity = Number(
    row.available_quantity ?? row.quantity ?? row.total_quantity ?? 0,
  );
  const liveSerialCount = Number(
    row.live_serial_count ?? row.serial_count ?? availableQuantity ?? 0,
  );

  return {
    ...row,
    quantity: serializedRequired ? liveSerialCount : Number(row.quantity ?? availableQuantity ?? 0),
    total_quantity: serializedRequired
      ? liveSerialCount
      : Number(row.total_quantity ?? row.quantity ?? availableQuantity ?? 0),
    available_quantity: serializedRequired
      ? liveSerialCount
      : availableQuantity,
    serial_count: serializedRequired
      ? liveSerialCount
      : Number(row.serial_count ?? liveSerialCount ?? 0),
    serialized_required: serializedRequired,
  };
};

const normalizeText = (value, fallback = "") => {
  const text = String(value || "").trim();
  return text || fallback;
};

const getItemStatus = (quantity) => {
  const qty = Number(quantity || 0);
  if (qty === 0) return "Out of Stock";
  if (qty <= 5) return "Low Stock";
  return "Available";
};

class StockRepository {
  async moveDayBookItemsToStock(daybookId, transaction = null, actor = null) {
    try {
      const daybook = await DayBook.findByPk(daybookId, {
        attributes: ["id", "location_scope"],
        transaction: transaction || undefined,
      });
      if (!daybook) {
        throw new Error("DayBook not found");
      }
      if (actor) {
        assertActorCanAccessLocation(
          actor,
          daybook.location_scope,
          "move this daybook into stock",
        );
      }

      // Step 1: Find approved DayBookItems where the approval_level is 3
      const dayBookItems = await DayBookItem.findAll({
        where: { daybook_id: daybookId, stock_id: null }, // Only get items without a stock_id
        transaction,
      });

      // Step 2: Create corresponding Stock entries for each DayBookItem
      const createdStocks = [];
      for (const item of dayBookItems) {
        const itemMaster = await ensureItemMaster({
          itemCategoryId: item.item_category_id,
          skuUnit: item.sku_unit || "Unit",
          itemName: item.item_name,
          aliasText: item.item_name,
          transaction,
        });

        const newStock = await Stock.create(
          {
            item_category_id: item.item_category_id, // Category from DayBookItem
            item_name: item.item_name, // Item name from DayBookItem
            quantity: item.quantity, // Quantity from DayBookItem
            sku_unit: item.sku_unit || "Unit",
            rate: item.rate, // Rate from DayBookItem
            gst_rate: item.gst_rate, // GST rate from DayBookItem
            amount: item.amount, // Amount from DayBookItem
            item_master_id: itemMaster?.id || null,
            source: "DAYBOOK",
            location_scope: daybook.location_scope || null,
          },
          { transaction },
        );

        // Step 3: Update DayBookItem with stock_id after moving to stock
        await item.update(
          {
            stock_id: newStock.id,
            item_master_id: itemMaster?.id || null,
          },
          { transaction },
        );

        await logStockMovement(
          {
            itemMasterId: itemMaster?.id,
            stockId: newStock.id,
            movementType: "DAYBOOK_IN",
            qty: Number(item.quantity || 0),
            skuUnit: item.sku_unit || "Unit",
            movementAt: new Date(),
            referenceType: "DayBookItem",
            referenceId: item.id,
            performedBy: "System",
            remarks: "Stock created from approved DayBook",
            locationScope: daybook.location_scope || null,
            metadata: {
              daybook_id: Number(item.daybook_id),
              daybook_item_id: Number(item.id),
            },
          },
          { transaction },
        );
        createdStocks.push(newStock); // Store created stock entries
      }
      return createdStocks;
    } catch (error) {
      console.error("Error while moving DayBookItems to Stock:", error);
      throw new Error("Error moving DayBookItems to Stock");
    }
  }

  async getAll(actor = null) {
    try {
      const where = {
        is_active: true,
      };
      const locationWhere = buildLocationScopeWhere(actor || {});
      if (locationWhere) Object.assign(where, locationWhere);
      return await Stock.findAll({
        where,
        order: [["id", "DESC"]],
      });
    } catch (error) {
      console.log("Something went wrong on repository layer (getAll stocks).");
      throw error;
    }
  }
  async getAllStocksByCategory(filters = {}) {
    const {
      search,
      categoryHeadId,
      categoryGroupId,
      stockLevel,
      source,
      limit = null,
      cursor = null,
      cursorMode = false,
      viewerActor = null,
    } = filters;

    const categoryWhereClauses = [];
    const whereGroup = {};
    const havingConditions = [];

    // 🔍 Search by category name
    if (search) {
      categoryWhereClauses.push({
        category_name: {
          [Op.like]: `%${search}%`,
        },
      });
    }

    // 🧩 Category Group filter
    if (categoryGroupId) {
      categoryWhereClauses.push({ group_id: categoryGroupId });
    }

    // 🧩 Category Head filter (IMPORTANT FIX)
    if (categoryHeadId) {
      whereGroup.head_id = categoryHeadId;
    }

    const categoryQuantitySql = `
      CASE
        WHEN MAX(COALESCE(\`ItemCategory\`.\`serialized_required\`, 0)) = 1
          THEN SUM(COALESCE((
            SELECT COUNT(*)
            FROM Assets a
            WHERE a.stock_id = \`Stock\`.\`id\`
              AND a.status = 'InStore'
              AND a.is_active = 1
          ), 0))
        ELSE SUM(\`Stock\`.\`quantity\`)
      END
    `;

    // 📦 Stock Level filter
    if (stockLevel === "OUT") {
      havingConditions.push(sequelize.literal(`${categoryQuantitySql} = 0`));
    }

    if (stockLevel === "LOW") {
      havingConditions.push(
        sequelize.literal(`${categoryQuantitySql} BETWEEN 1 AND 5`),
      );
    }

    if (stockLevel === "AVAILABLE") {
      havingConditions.push(sequelize.literal(`${categoryQuantitySql} > 5`));
    }

    const useCursorMode = Boolean(cursorMode) && limit != null;
    const safeLimit = useCursorMode ? normalizeLimit(limit, 100, 500) : null;
    const cursorParts = useCursorMode ? decodeCursor(cursor) : null;
    if (
      useCursorMode &&
      cursorParts &&
      typeof cursorParts.category_name === "string" &&
      Number.isFinite(Number(cursorParts.item_category_id))
    ) {
      categoryWhereClauses.push({
        [Op.or]: [
          { category_name: { [Op.gt]: cursorParts.category_name } },
          {
            category_name: cursorParts.category_name,
            id: { [Op.gt]: Number(cursorParts.item_category_id) },
          },
        ],
      });
    }

    const whereCategory =
      categoryWhereClauses.length > 0
        ? { [Op.and]: categoryWhereClauses }
        : undefined;
    const normalizedSource = normalizeStockSource(source);
    const stockWhere = {
      is_active: true,
      ...(normalizedSource ? { source: normalizedSource } : {}),
    };
    const locationWhere = buildLocationScopeWhere(viewerActor || {});
    if (locationWhere) Object.assign(stockWhere, locationWhere);

    const stocks = await Stock.findAll({
      where: stockWhere,
      attributes: [
        "item_category_id",
        [sequelize.col("ItemCategory.category_name"), "category_name"],
        [
          sequelize.literal(categoryQuantitySql),
          "total_quantity",
        ],
        [
          sequelize.literal(
            "SUM(CASE WHEN `Stock`.`source` = 'DAYBOOK' THEN `Stock`.`quantity` ELSE 0 END)",
          ),
          "daybook_quantity",
        ],
        [
          sequelize.literal(
            "SUM(CASE WHEN `Stock`.`source` = 'MIGRATION' THEN `Stock`.`quantity` ELSE 0 END)",
          ),
          "migration_quantity",
        ],
        [
          sequelize.literal(
            "SUM(CASE WHEN `Stock`.`source` = 'DAYBOOK' THEN 1 ELSE 0 END)",
          ),
          "daybook_lot_count",
        ],
        [
          sequelize.literal(
            "SUM(CASE WHEN `Stock`.`source` = 'MIGRATION' THEN 1 ELSE 0 END)",
          ),
          "migration_lot_count",
        ],
        [
          sequelize.literal(
            "SUM(CASE WHEN `Stock`.`source` IS NULL OR `Stock`.`source` NOT IN ('DAYBOOK','MIGRATION') THEN 1 ELSE 0 END)",
          ),
          "unknown_lot_count",
        ],
        [
          sequelize.literal(`
            CASE
              WHEN SUM(CASE WHEN \`Stock\`.\`source\` = 'DAYBOOK' THEN 1 ELSE 0 END) > 0
                   AND SUM(CASE WHEN \`Stock\`.\`source\` = 'MIGRATION' THEN 1 ELSE 0 END) > 0
                THEN 'Mixed'
              WHEN SUM(CASE WHEN \`Stock\`.\`source\` = 'DAYBOOK' THEN 1 ELSE 0 END) > 0
                THEN 'DayBook'
              WHEN SUM(CASE WHEN \`Stock\`.\`source\` = 'MIGRATION' THEN 1 ELSE 0 END) > 0
                THEN 'Migration'
              ELSE 'Unclassified'
            END
          `),
          "source_profile",
        ],
      ],
      include: [
        {
          model: ItemCategory,
          attributes: [],
          ...(whereCategory ? { where: whereCategory } : {}),
          include: [
            {
              model: ItemCategoryGroup,
              as: "group",
              attributes: [],
              where: Object.keys(whereGroup).length ? whereGroup : undefined,
              include: [
                {
                  model: ItemCategoryHead,
                  as: "head",
                  attributes: [],
                },
              ],
            },
          ],
        },
      ],
      group: ["Stock.item_category_id", "ItemCategory.category_name"],
      ...(havingConditions.length > 0 && {
        having: { [Op.and]: havingConditions },
      }),
      order: [
        ["item_category_id", "ASC"],
        [
          sequelize.fn("LOWER", sequelize.col("ItemCategory.category_name")),
          "ASC",
        ],
      ],
      ...(useCursorMode ? { limit: safeLimit + 1 } : {}),
      raw: true,
    });

    const normalizedStocks = stocks.map((row) => {
      const normalized = normalizeSerializedAvailabilityRow(row);
      return {
        ...normalized,
        total_quantity: Number(normalized.total_quantity || 0),
        daybook_quantity: Number(row.daybook_quantity || 0),
        migration_quantity: Number(row.migration_quantity || 0),
        daybook_lot_count: Number(row.daybook_lot_count || 0),
        migration_lot_count: Number(row.migration_lot_count || 0),
        unknown_lot_count: Number(row.unknown_lot_count || 0),
      };
    });

    if (!useCursorMode) {
      return normalizedStocks;
    }

    const hasMore = normalizedStocks.length > safeLimit;
    const rows = hasMore
      ? normalizedStocks.slice(0, safeLimit)
      : normalizedStocks;
    const lastRow = rows.length ? rows[rows.length - 1] : null;
    const nextCursor =
      hasMore && lastRow
        ? encodeCursor({
            item_category_id: Number(lastRow.item_category_id),
            category_name: lastRow.category_name || "",
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

  async getStocksByCategoryId(categoryId, filters = {}) {
    const {
      search,
      stockLevel,
      source,
      limit = null,
      cursor = null,
      cursorMode = false,
      onlyInStock = false,
      groupByMaster = false,
      viewerActor = null,
    } = filters;
    const normalizedSource = normalizeStockSource(source);
    const locationWhere = buildLocationScopeWhere(viewerActor || {});
    const scopedLocations =
      locationWhere?.location_scope?.[Op.in] || null;

    if (groupByMaster) {
      const categoryIdNum = Number(categoryId);
      if (!Number.isFinite(categoryIdNum) || categoryIdNum <= 0) {
        return [];
      }
      const groupedQuantitySql = `
        CASE
          WHEN MAX(COALESCE(ic.serialized_required, 0)) = 1
            THEN SUM(COALESCE(ac.instore_count, 0))
          ELSE SUM(s.quantity)
        END
      `;
      const groupedHaving = [];
      if (stockLevel === "OUT") groupedHaving.push(`${groupedQuantitySql} = 0`);
      if (stockLevel === "LOW")
        groupedHaving.push(`${groupedQuantitySql} BETWEEN 1 AND 5`);
      if (stockLevel === "AVAILABLE") groupedHaving.push(`${groupedQuantitySql} > 5`);
      if (onlyInStock) groupedHaving.push(`${groupedQuantitySql} > 0`);
      const groupedHavingSql =
        groupedHaving.length > 0
          ? ` HAVING ${groupedHaving.join(" AND ")}`
          : "";
      const sourceWhereSql = normalizedSource ? " AND s.source = :source" : "";
      const locationWhereSql =
        Array.isArray(scopedLocations) && scopedLocations.length
          ? " AND s.location_scope IN (:locationScopes)"
          : locationWhere?.location_scope
            ? " AND s.location_scope = :singleLocationScope"
            : "";

      const searchTerm = String(search || "").trim();
      const searchLike = searchTerm ? `%${searchTerm}%` : null;
      let rows = [];
      try {
        const result = await sequelize.query(
          `
            SELECT
              MIN(s.id) AS id,
              MAX(s.id) AS latest_stock_id,
              MAX(s.item_master_id) AS item_master_id,
              MAX(s.item_category_id) AS item_category_id,
              COALESCE(MAX(im.display_name), MAX(s.item_name)) AS item_name,
              ${groupedQuantitySql} AS quantity,
              SUM(CASE WHEN s.source = 'DAYBOOK' THEN s.quantity ELSE 0 END) AS daybook_quantity,
              SUM(CASE WHEN s.source = 'MIGRATION' THEN s.quantity ELSE 0 END) AS migration_quantity,
              SUM(CASE WHEN s.source = 'DAYBOOK' THEN 1 ELSE 0 END) AS daybook_lot_count,
              SUM(CASE WHEN s.source = 'MIGRATION' THEN 1 ELSE 0 END) AS migration_lot_count,
              SUM(CASE WHEN s.source IS NULL OR s.source NOT IN ('DAYBOOK','MIGRATION') THEN 1 ELSE 0 END) AS unknown_lot_count,
              CASE
                WHEN SUM(CASE WHEN s.source = 'DAYBOOK' THEN 1 ELSE 0 END) > 0
                     AND SUM(CASE WHEN s.source = 'MIGRATION' THEN 1 ELSE 0 END) > 0
                  THEN 'Mixed'
                WHEN SUM(CASE WHEN s.source = 'DAYBOOK' THEN 1 ELSE 0 END) > 0
                  THEN 'DayBook'
                WHEN SUM(CASE WHEN s.source = 'MIGRATION' THEN 1 ELSE 0 END) > 0
                  THEN 'Migration'
                ELSE 'Unclassified'
              END AS source_profile,
              CASE
                WHEN COUNT(DISTINCT s.source) = 1 THEN MAX(s.source)
                ELSE 'MIXED'
              END AS source,
              MAX(s.sku_unit) AS sku_unit,
              MAX(s.rate) AS rate,
              MAX(s.gst_rate) AS gst_rate,
              MAX(s.amount) AS amount,
              MAX(ic.category_name) AS category_name,
              MAX(ic.serialized_required) AS serialized_required,
              SUM(COALESCE(ac.instore_count, 0)) AS serial_count,
              SUM(COALESCE(ac.instore_count, 0)) AS live_serial_count,
              COUNT(*) AS lot_count,
              GROUP_CONCAT(s.id ORDER BY s.id ASC) AS stock_ids
            FROM Stocks s
            LEFT JOIN ItemMasters im
              ON im.id = s.item_master_id
            LEFT JOIN ItemCategories ic
              ON ic.id = s.item_category_id
            LEFT JOIN (
              SELECT d.stock_id, COUNT(*) AS serial_count
              FROM DayBookItemSerials ds
              INNER JOIN DayBookItems d
                ON d.id = ds.daybook_item_id
              GROUP BY d.stock_id
            ) sc
              ON sc.stock_id = s.id
            LEFT JOIN (
              SELECT a.stock_id, COUNT(*) AS instore_count
              FROM Assets a
              WHERE a.status = 'InStore'
                AND a.is_active = 1
              GROUP BY a.stock_id
            ) ac
              ON ac.stock_id = s.id
            WHERE s.item_category_id = :categoryId
              AND s.is_active = 1
              ${sourceWhereSql}
              ${locationWhereSql}
              AND (
                :searchLike IS NULL
                OR s.item_name LIKE :searchLike
                OR im.display_name LIKE :searchLike
              )
            GROUP BY
              CASE
                WHEN s.item_master_id IS NULL
                  THEN CONCAT('NAME-', LOWER(TRIM(s.item_name)), '|', COALESCE(s.sku_unit, ''))
                ELSE CONCAT('MASTER-', s.item_master_id)
              END
            ${groupedHavingSql}
            ORDER BY
              LOWER(COALESCE(MAX(im.display_name), MAX(s.item_name))) ASC,
              MIN(s.id) ASC
          `,
          {
            replacements: {
              categoryId: categoryIdNum,
              searchLike,
              source: normalizedSource,
              locationScopes: scopedLocations,
              singleLocationScope:
                !Array.isArray(scopedLocations) && locationWhere?.location_scope
                  ? locationWhere.location_scope
                  : null,
            },
          },
        );
        rows = result?.[0] || [];
      } catch (error) {
        console.error(
          "StockRepository.getStocksByCategoryId(groupByMaster) failed:",
          {
            message: error?.message,
            sqlMessage: error?.parent?.sqlMessage,
            code: error?.parent?.code,
            errno: error?.parent?.errno,
            sqlState: error?.parent?.sqlState,
            sql: error?.sql,
          },
        );
        throw error;
      }

      const normalizedRows = (rows || []).map((row) => {
        const normalized = normalizeSerializedAvailabilityRow(row);
        return {
          ...normalized,
          id: Number(row.id),
          stock_id: Number(row.id),
          item_master_id: row.item_master_id ? Number(row.item_master_id) : null,
          quantity: Number(normalized.quantity || 0),
          available_quantity: Number(normalized.available_quantity || 0),
          daybook_quantity: Number(row.daybook_quantity || 0),
          migration_quantity: Number(row.migration_quantity || 0),
          daybook_lot_count: Number(row.daybook_lot_count || 0),
          migration_lot_count: Number(row.migration_lot_count || 0),
          unknown_lot_count: Number(row.unknown_lot_count || 0),
          serial_count: Number(normalized.serial_count || 0),
          lot_count: Number(row.lot_count || 0),
        };
      });

      if (limit != null && String(limit).trim() !== "") {
        const safeLimit = normalizeLimit(limit, 100, 1000);
        return normalizedRows.slice(0, safeLimit);
      }
      return normalizedRows;
    }

    const where = {
      item_category_id: categoryId,
      is_active: true,
      ...(normalizedSource ? { source: normalizedSource } : {}),
    };
    if (locationWhere) Object.assign(where, locationWhere);

    if (search) {
      where.item_name = { [Op.like]: `%${search}%` };
    }

    const useCursorMode = Boolean(cursorMode) && limit != null;
    const safeLimit = useCursorMode ? normalizeLimit(limit, 100, 500) : null;
    const cursorParts = useCursorMode ? decodeCursor(cursor) : null;
    const cursorWhere = useCursorMode
      ? applyStringIdAscCursor(where, cursorParts, "item_name", "id")
      : where;

    const stocks = await Stock.findAll({
      where: cursorWhere,
      attributes: [
        "id",
        "item_name",
        "quantity",
        [
          sequelize.literal(buildInStoreAssetCountSql("Stock")),
          "live_serial_count",
        ],
        "source",
        "sku_unit",
        "rate",
        "gst_rate",
        "amount",
        [
          sequelize.literal(buildInStoreAssetCountSql("Stock")),
          "serial_count",
        ],
      ],
      include: [
        {
          model: ItemCategory,
          attributes: ["category_name", "serialized_required"],
        },
      ],
      order: [
        ["item_name", "ASC"],
        ["id", "ASC"],
      ],
      ...(useCursorMode ? { limit: safeLimit + 1 } : {}),
      raw: true,
    });

    const normalizedStocks = stocks
      .map((row) => {
        const normalized = normalizeSerializedAvailabilityRow(row);
        return {
          ...normalized,
          quantity: Number(normalized.quantity || 0),
          available_quantity: Number(normalized.available_quantity || 0),
          serial_count: Number(normalized.serial_count || 0),
        };
      })
      .filter((row) => {
        if (stockLevel === "OUT") return Number(row.quantity || 0) === 0;
        if (stockLevel === "LOW") {
          const qty = Number(row.quantity || 0);
          return qty >= 1 && qty <= 5;
        }
        if (stockLevel === "AVAILABLE") return Number(row.quantity || 0) > 5;
        if (onlyInStock) return Number(row.quantity || 0) > 0;
        return true;
      });

    if (!useCursorMode) {
      return normalizedStocks;
    }

    const hasMore = normalizedStocks.length > safeLimit;
    const rows = hasMore ? normalizedStocks.slice(0, safeLimit) : normalizedStocks;
    const lastRow = rows.length ? rows[rows.length - 1] : null;
    const nextCursor =
      hasMore && lastRow
        ? encodeCursor({
            item_name: lastRow.item_name || "",
            id: Number(lastRow.id),
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

  async getOutOfStockReport({ viewerActor = null } = {}) {
    const access = collectActorLocationScopes(viewerActor || {});
    if (!access.unrestricted && !access.scopes.length) {
      return {
        rows: [],
        summary: {
          total_items: 0,
          out_count: 0,
          low_count: 0,
          available_count: 0,
          affected_categories: 0,
          affected_groups: 0,
          affected_heads: 0,
        },
        critical_categories: [],
        generated_at: new Date().toISOString(),
      };
    }

    const locationWhereSql = access.unrestricted
      ? ""
      : " AND s.location_scope IN (:locationScopes)";

    const [rows] = await sequelize.query(
      `
        SELECT
          ch.id AS head_id,
          ch.category_head_name AS head_name,
          cg.id AS group_id,
          cg.category_group_name AS group_name,
          ic.id AS category_id,
          ic.category_name AS category_name,
          MAX(ic.serialized_required) AS serialized_required,
          CASE
            WHEN s.item_master_id IS NULL
              THEN CONCAT('NAME-', LOWER(TRIM(s.item_name)), '|', COALESCE(s.sku_unit, ''))
            ELSE CONCAT('MASTER-', s.item_master_id)
          END AS item_key,
          MAX(s.item_master_id) AS item_master_id,
          COALESCE(MAX(im.display_name), MAX(s.item_name)) AS item_name,
          CASE
            WHEN MAX(COALESCE(ic.serialized_required, 0)) = 1
              THEN SUM(COALESCE(ac.instore_count, 0))
            ELSE SUM(s.quantity)
          END AS quantity,
          MAX(s.sku_unit) AS sku_unit,
          COUNT(*) AS lot_count,
          SUM(CASE WHEN s.source = 'DAYBOOK' THEN s.quantity ELSE 0 END) AS daybook_quantity,
          SUM(CASE WHEN s.source = 'MIGRATION' THEN s.quantity ELSE 0 END) AS migration_quantity
        FROM Stocks s
        INNER JOIN ItemCategories ic
          ON ic.id = s.item_category_id
        LEFT JOIN ItemCategoryGroups cg
          ON cg.id = ic.group_id
        LEFT JOIN ItemCategoryHeads ch
          ON ch.id = cg.head_id
        LEFT JOIN ItemMasters im
          ON im.id = s.item_master_id
        LEFT JOIN (
          SELECT a.stock_id, COUNT(*) AS instore_count
          FROM Assets a
          WHERE a.status = 'InStore'
            AND a.is_active = 1
          GROUP BY a.stock_id
        ) ac
          ON ac.stock_id = s.id
        WHERE s.is_active = 1
        ${locationWhereSql}
        GROUP BY
          ch.id,
          ch.category_head_name,
          cg.id,
          cg.category_group_name,
          ic.id,
          ic.category_name,
          CASE
            WHEN s.item_master_id IS NULL
              THEN CONCAT('NAME-', LOWER(TRIM(s.item_name)), '|', COALESCE(s.sku_unit, ''))
            ELSE CONCAT('MASTER-', s.item_master_id)
          END
        ORDER BY
          LOWER(ch.category_head_name) ASC,
          LOWER(cg.category_group_name) ASC,
          LOWER(ic.category_name) ASC,
          LOWER(COALESCE(MAX(im.display_name), MAX(s.item_name))) ASC
      `,
      {
        replacements: access.unrestricted ? {} : { locationScopes: access.scopes },
      },
    );

    const normalizedRows = (rows || []).map((row, index) => {
      const quantity = Number(row.quantity || 0);
      const serializedRequired =
        Number(row.serialized_required || 0) === 1 ||
        row.serialized_required === true;
      return {
        id: index + 1,
        item_key: row.item_key,
        item_master_id: row.item_master_id ? Number(row.item_master_id) : null,
        head_id: row.head_id ? Number(row.head_id) : null,
        head_name: normalizeText(row.head_name, "Unassigned Head"),
        group_id: row.group_id ? Number(row.group_id) : null,
        group_name: normalizeText(row.group_name, "Unassigned Group"),
        category_id: row.category_id ? Number(row.category_id) : null,
        category_name: normalizeText(row.category_name, "Unassigned Category"),
        item_name: normalizeText(row.item_name, "Unnamed Item"),
        quantity,
        sku_unit: normalizeText(row.sku_unit, "Unit"),
        lot_count: Number(row.lot_count || 0),
        daybook_quantity: Number(row.daybook_quantity || 0),
        migration_quantity: Number(row.migration_quantity || 0),
        type_label: serializedRequired ? "Asset" : "Consumable",
        serialized_required: serializedRequired,
        status: getItemStatus(quantity),
      };
    });

    const summary = normalizedRows.reduce(
      (acc, row) => {
        acc.total_items += 1;
        if (row.status === "Out of Stock") acc.out_count += 1;
        else if (row.status === "Low Stock") acc.low_count += 1;
        else acc.available_count += 1;
        acc.category_ids.add(row.category_id);
        acc.group_ids.add(row.group_id);
        acc.head_ids.add(row.head_id);
        return acc;
      },
      {
        total_items: 0,
        out_count: 0,
        low_count: 0,
        available_count: 0,
        category_ids: new Set(),
        group_ids: new Set(),
        head_ids: new Set(),
      },
    );

    const criticalCategories = [...normalizedRows.reduce((map, row) => {
      const key = row.category_id || row.category_name;
      const current = map.get(key) || {
        category_id: row.category_id,
        category_name: row.category_name,
        group_name: row.group_name,
        head_name: row.head_name,
        total_items: 0,
        out_count: 0,
        low_count: 0,
        available_count: 0,
      };
      current.total_items += 1;
      if (row.status === "Out of Stock") current.out_count += 1;
      else if (row.status === "Low Stock") current.low_count += 1;
      else current.available_count += 1;
      map.set(key, current);
      return map;
    }, new Map()).values()]
      .sort((left, right) => {
        if (right.out_count !== left.out_count) return right.out_count - left.out_count;
        if (right.low_count !== left.low_count) return right.low_count - left.low_count;
        return left.category_name.localeCompare(right.category_name);
      })
      .slice(0, 12);

    return {
      rows: normalizedRows,
      summary: {
        total_items: summary.total_items,
        out_count: summary.out_count,
        low_count: summary.low_count,
        available_count: summary.available_count,
        affected_categories: [...summary.category_ids].filter(Boolean).length,
        affected_groups: [...summary.group_ids].filter(Boolean).length,
        affected_heads: [...summary.head_ids].filter(Boolean).length,
      },
      critical_categories: criticalCategories,
      generated_at: new Date().toISOString(),
    };
  }
}

module.exports = StockRepository;
