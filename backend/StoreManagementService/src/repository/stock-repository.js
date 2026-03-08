const {
  DayBookItem,
  ItemCategory,
  Stock,
  sequelize,
  ItemCategoryGroup,
  ItemCategoryHead,
} = require("../models"); // Import Sequelize models
const { ensureItemMaster } = require("../services/item-master-service");
const { logStockMovement } = require("../services/stock-movement-service");

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

class StockRepository {
  async moveDayBookItemsToStock(daybookId, transaction = null) {
    try {
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

  async getAll() {
    try {
      return await Stock.findAll({
        where: { is_active: true },
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

    // 📦 Stock Level filter
    if (stockLevel === "OUT") {
      havingConditions.push(sequelize.literal("SUM(quantity) = 0"));
    }

    if (stockLevel === "LOW") {
      havingConditions.push(sequelize.literal("SUM(quantity) BETWEEN 1 AND 5"));
    }

    if (stockLevel === "AVAILABLE") {
      havingConditions.push(sequelize.literal("SUM(quantity) > 5"));
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

    const stocks = await Stock.findAll({
      where: stockWhere,
      attributes: [
        "item_category_id",
        [sequelize.col("ItemCategory.category_name"), "category_name"],
        [sequelize.fn("SUM", sequelize.col("quantity")), "total_quantity"],
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

    const normalizedStocks = stocks.map((row) => ({
      ...row,
      total_quantity: Number(row.total_quantity || 0),
      daybook_quantity: Number(row.daybook_quantity || 0),
      migration_quantity: Number(row.migration_quantity || 0),
      daybook_lot_count: Number(row.daybook_lot_count || 0),
      migration_lot_count: Number(row.migration_lot_count || 0),
      unknown_lot_count: Number(row.unknown_lot_count || 0),
    }));

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
    } = filters;
    const normalizedSource = normalizeStockSource(source);

    if (groupByMaster) {
      const categoryIdNum = Number(categoryId);
      if (!Number.isFinite(categoryIdNum) || categoryIdNum <= 0) {
        return [];
      }
      const groupedHaving = [];
      if (stockLevel === "OUT") groupedHaving.push("SUM(s.quantity) = 0");
      if (stockLevel === "LOW")
        groupedHaving.push("SUM(s.quantity) BETWEEN 1 AND 5");
      if (stockLevel === "AVAILABLE") groupedHaving.push("SUM(s.quantity) > 5");
      if (onlyInStock) groupedHaving.push("SUM(s.quantity) > 0");
      const groupedHavingSql =
        groupedHaving.length > 0
          ? ` HAVING ${groupedHaving.join(" AND ")}`
          : "";
      const sourceWhereSql = normalizedSource ? " AND s.source = :source" : "";

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
              SUM(s.quantity) AS quantity,
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
              SUM(COALESCE(sc.serial_count, 0)) AS serial_count,
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
            WHERE s.item_category_id = :categoryId
              AND s.is_active = 1
              ${sourceWhereSql}
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

      const normalizedRows = (rows || []).map((row) => ({
        ...row,
        id: Number(row.id),
        stock_id: Number(row.id),
        item_master_id: row.item_master_id ? Number(row.item_master_id) : null,
        quantity: Number(row.quantity || 0),
        daybook_quantity: Number(row.daybook_quantity || 0),
        migration_quantity: Number(row.migration_quantity || 0),
        daybook_lot_count: Number(row.daybook_lot_count || 0),
        migration_lot_count: Number(row.migration_lot_count || 0),
        unknown_lot_count: Number(row.unknown_lot_count || 0),
        serial_count: Number(row.serial_count || 0),
        lot_count: Number(row.lot_count || 0),
      }));

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

    if (search) {
      where.item_name = { [Op.like]: `%${search}%` };
    }

    if (stockLevel === "OUT") where.quantity = 0;
    if (stockLevel === "LOW") where.quantity = { [Op.between]: [1, 5] };
    if (stockLevel === "AVAILABLE") where.quantity = { [Op.gt]: 5 };
    if (onlyInStock) where.quantity = { [Op.gt]: 0 };

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
        "source",
        "sku_unit",
        "rate",
        "gst_rate",
        "amount",
        [
          sequelize.literal(`(
          SELECT COUNT(*)
          FROM DayBookItemSerials s
          INNER JOIN DayBookItems d
            ON d.id = s.daybook_item_id
          WHERE d.stock_id = Stock.id
        )`),
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

    if (!useCursorMode) {
      return stocks;
    }

    const hasMore = stocks.length > safeLimit;
    const rows = hasMore ? stocks.slice(0, safeLimit) : stocks;
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
}

module.exports = StockRepository;
