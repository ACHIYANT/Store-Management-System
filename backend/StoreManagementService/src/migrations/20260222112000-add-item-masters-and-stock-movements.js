"use strict";

const DEFAULT_SKU_UNIT = "Unit";

const toText = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const normalizeSkuUnit = (value) => {
  const clean = toText(value);
  return clean || DEFAULT_SKU_UNIT;
};

const normalizeItemName = (value) => {
  const clean = toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!clean) return "";
  const tokens = clean.split(/\s+/).filter(Boolean).sort();
  return tokens.join(" ");
};

const buildItemCode = (num) => `ITM-${String(num).padStart(6, "0")}`;

async function hasTable(queryInterface, tableName) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS c
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = :tableName
    `,
    { replacements: { tableName } },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function hasColumn(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(table, columnName);
}

async function hasConstraint(queryInterface, tableName, constraintName) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS c
      FROM information_schema.table_constraints
      WHERE table_schema = DATABASE()
        AND table_name = :tableName
        AND constraint_name = :constraintName
    `,
    { replacements: { tableName, constraintName } },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function hasForeignKeyOnFields(queryInterface, tableName, fields = []) {
  const normalizedFields = Array.isArray(fields)
    ? fields.map((field) => String(field).trim()).filter(Boolean)
    : [String(fields || "").trim()].filter(Boolean);
  if (!normalizedFields.length) return false;

  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT
        kcu.constraint_name AS constraint_name,
        kcu.column_name AS column_name,
        kcu.ordinal_position AS ordinal_position
      FROM information_schema.key_column_usage kcu
      WHERE kcu.table_schema = DATABASE()
        AND kcu.table_name = :tableName
        AND kcu.referenced_table_name IS NOT NULL
      ORDER BY kcu.constraint_name ASC, kcu.ordinal_position ASC
    `,
    { replacements: { tableName } },
  );

  const grouped = new Map();
  for (const row of rows || []) {
    const key = String(row.constraint_name || "");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(String(row.column_name || "").trim());
  }

  const needle = normalizedFields.join("|");
  for (const columns of grouped.values()) {
    if (columns.join("|") === needle) {
      return true;
    }
  }
  return false;
}

async function hasIndex(queryInterface, tableName, indexName) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS c
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = :tableName
        AND index_name = :indexName
    `,
    { replacements: { tableName, indexName } },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function addColumnIfMissing(
  queryInterface,
  Sequelize,
  tableName,
  columnName,
  columnConfig,
) {
  if (await hasColumn(queryInterface, tableName, columnName)) return;
  await queryInterface.addColumn(tableName, columnName, columnConfig);
}

async function addIndexIfMissing(queryInterface, tableName, fields, options = {}) {
  const indexName = options.name;
  if (indexName && (await hasIndex(queryInterface, tableName, indexName))) return;
  await queryInterface.addIndex(tableName, fields, options);
}

async function addConstraintIfMissing(queryInterface, tableName, options) {
  if (
    String(options?.type || "").toLowerCase() === "foreign key" &&
    (await hasForeignKeyOnFields(queryInterface, tableName, options?.fields || []))
  ) {
    return;
  }
  const constraintName = options.name;
  if (constraintName && (await hasConstraint(queryInterface, tableName, constraintName))) {
    return;
  }
  await queryInterface.addConstraint(tableName, options);
}

async function removeConstraintIfExists(queryInterface, tableName, constraintName) {
  if (!(await hasConstraint(queryInterface, tableName, constraintName))) return;
  await queryInterface.removeConstraint(tableName, constraintName);
}

async function removeIndexIfExists(queryInterface, tableName, indexName) {
  if (!(await hasIndex(queryInterface, tableName, indexName))) return;
  await queryInterface.removeIndex(tableName, indexName);
}

async function removeColumnIfExists(queryInterface, tableName, columnName) {
  if (!(await hasColumn(queryInterface, tableName, columnName))) return;
  await queryInterface.removeColumn(tableName, columnName);
}

async function nullifyOrphanForeignKeys(
  queryInterface,
  {
    tableName,
    fkColumn,
    refTableName,
    refColumn = "id",
  },
) {
  if (!(await hasTable(queryInterface, tableName))) return;
  if (!(await hasTable(queryInterface, refTableName))) return;
  if (!(await hasColumn(queryInterface, tableName, fkColumn))) return;

  await queryInterface.sequelize.query(
    `
      UPDATE \`${tableName}\` t
      LEFT JOIN \`${refTableName}\` r
        ON r.\`${refColumn}\` = t.\`${fkColumn}\`
      SET t.\`${fkColumn}\` = NULL
      WHERE t.\`${fkColumn}\` IS NOT NULL
        AND r.\`${refColumn}\` IS NULL
    `,
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await hasTable(queryInterface, "ItemMasters"))) {
      await queryInterface.createTable("ItemMasters", {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        item_code: {
          type: Sequelize.STRING(30),
          allowNull: false,
          unique: true,
        },
        display_name: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        normalized_name: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        item_category_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "ItemCategories",
            key: "id",
          },
          onDelete: "RESTRICT",
          onUpdate: "CASCADE",
        },
        sku_unit: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: DEFAULT_SKU_UNIT,
        },
        serialized_required: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }

    await addIndexIfMissing(
      queryInterface,
      "ItemMasters",
      ["item_category_id", "sku_unit", "normalized_name"],
      {
        unique: true,
        name: "uq_itemmasters_identity",
      },
    );
    await addIndexIfMissing(queryInterface, "ItemMasters", ["normalized_name"], {
      name: "idx_itemmasters_normalized_name",
    });

    if (!(await hasTable(queryInterface, "ItemMasterAliases"))) {
      await queryInterface.createTable("ItemMasterAliases", {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        item_master_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: {
            model: "ItemMasters",
            key: "id",
          },
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        },
        alias_text: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        normalized_alias: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }

    await addIndexIfMissing(
      queryInterface,
      "ItemMasterAliases",
      ["item_master_id", "normalized_alias"],
      {
        unique: true,
        name: "uq_itemmasteraliases_master_alias",
      },
    );
    await addIndexIfMissing(queryInterface, "ItemMasterAliases", ["normalized_alias"], {
      name: "idx_itemmasteraliases_normalized_alias",
    });

    if (!(await hasTable(queryInterface, "StockMovements"))) {
      await queryInterface.createTable("StockMovements", {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        item_master_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: {
            model: "ItemMasters",
            key: "id",
          },
          onDelete: "RESTRICT",
          onUpdate: "CASCADE",
        },
        stock_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: "Stocks",
            key: "id",
          },
          onDelete: "SET NULL",
          onUpdate: "CASCADE",
        },
        movement_type: {
          type: Sequelize.ENUM(
            "OPENING_BALANCE",
            "DAYBOOK_IN",
            "ISSUE_OUT",
            "RETURN_IN",
            "TRANSFER_OUT",
            "TRANSFER_IN",
            "REPAIR_OUT",
            "REPAIR_IN",
            "ADJUST_PLUS",
            "ADJUST_MINUS",
            "DISPOSE_OUT",
            "EWASTE_OUT",
            "MRN_CANCELLED",
          ),
          allowNull: false,
        },
        qty: {
          type: Sequelize.DECIMAL(14, 3),
          allowNull: false,
        },
        sku_unit: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: DEFAULT_SKU_UNIT,
        },
        movement_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        reference_type: {
          type: Sequelize.STRING(40),
          allowNull: true,
        },
        reference_id: {
          type: Sequelize.BIGINT,
          allowNull: true,
        },
        from_employee_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        to_employee_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        performed_by: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        remarks: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        metadata_json: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }

    await addIndexIfMissing(queryInterface, "StockMovements", ["item_master_id", "movement_at", "id"], {
      name: "idx_stockmovements_item_time_id",
    });
    await addIndexIfMissing(queryInterface, "StockMovements", ["stock_id", "movement_at", "id"], {
      name: "idx_stockmovements_stock_time_id",
    });
    await addIndexIfMissing(queryInterface, "StockMovements", ["movement_type", "movement_at", "id"], {
      name: "idx_stockmovements_type_time_id",
    });
    await addIndexIfMissing(queryInterface, "StockMovements", ["reference_type", "reference_id"], {
      name: "idx_stockmovements_reference",
    });

    await addColumnIfMissing(queryInterface, Sequelize, "Stocks", "item_master_id", {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "DayBookItems", "item_master_id", {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await addColumnIfMissing(
      queryInterface,
      Sequelize,
      "RequisitionItems",
      "item_master_id",
      {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
      },
    );
    await addColumnIfMissing(queryInterface, Sequelize, "IssuedItems", "item_master_id", {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await addColumnIfMissing(queryInterface, Sequelize, "Assets", "item_master_id", {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });

    const [categoryRows] = await queryInterface.sequelize.query(
      `
        SELECT id, serialized_required
        FROM ItemCategories
      `,
    );
    const categorySerializedMap = new Map(
      (categoryRows || []).map((row) => [
        Number(row.id),
        Boolean(row.serialized_required),
      ]),
    );

    const [existingMasters] = await queryInterface.sequelize.query(
      `
        SELECT id, item_code, item_category_id, sku_unit, normalized_name, display_name
        FROM ItemMasters
      `,
    );

    let nextItemCodeSeq = 0;
    const identityMap = new Map();
    for (const row of existingMasters || []) {
      const cat = Number(row.item_category_id);
      const sku = normalizeSkuUnit(row.sku_unit);
      const norm = toText(row.normalized_name);
      if (cat && sku && norm) {
        identityMap.set(`${cat}|${sku}|${norm}`, Number(row.id));
      }
      const match = toText(row.item_code).match(/(\d+)$/);
      if (match) nextItemCodeSeq = Math.max(nextItemCodeSeq, Number(match[1]));
    }

    const ensureItemMaster = async ({
      rawName,
      itemCategoryId,
      skuUnit,
      aliasText,
    }) => {
      const itemCategoryNum = Number(itemCategoryId);
      const displayName = toText(rawName);
      const normalizedName = normalizeItemName(displayName);
      if (!itemCategoryNum || !normalizedName) return null;

      const sku = normalizeSkuUnit(skuUnit);
      const key = `${itemCategoryNum}|${sku}|${normalizedName}`;
      let itemMasterId = identityMap.get(key) || null;

      if (!itemMasterId) {
        nextItemCodeSeq += 1;
        const itemCode = buildItemCode(nextItemCodeSeq);
        const serializedRequired = categorySerializedMap.get(itemCategoryNum) || false;
        const now = new Date();
        const [insertResult] = await queryInterface.sequelize.query(
          `
            INSERT INTO ItemMasters
              (item_code, display_name, normalized_name, item_category_id, sku_unit, serialized_required, is_active, createdAt, updatedAt)
            VALUES
              (:itemCode, :displayName, :normalizedName, :itemCategoryId, :skuUnit, :serializedRequired, 1, :createdAt, :updatedAt)
          `,
          {
            replacements: {
              itemCode,
              displayName: displayName || normalizedName,
              normalizedName,
              itemCategoryId: itemCategoryNum,
              skuUnit: sku,
              serializedRequired: serializedRequired ? 1 : 0,
              createdAt: now,
              updatedAt: now,
            },
          },
        );

        itemMasterId = Number(insertResult.insertId);
        identityMap.set(key, itemMasterId);
      }

      const alias = toText(aliasText || rawName);
      const normalizedAlias = normalizeItemName(alias);
      if (alias && normalizedAlias && itemMasterId) {
        const now = new Date();
        await queryInterface.sequelize.query(
          `
            INSERT IGNORE INTO ItemMasterAliases
              (item_master_id, alias_text, normalized_alias, is_active, createdAt, updatedAt)
            VALUES
              (:itemMasterId, :aliasText, :normalizedAlias, 1, :createdAt, :updatedAt)
          `,
          {
            replacements: {
              itemMasterId,
              aliasText: alias,
              normalizedAlias,
              createdAt: now,
              updatedAt: now,
            },
          },
        );
      }

      return itemMasterId;
    };

    const [stockRows] = await queryInterface.sequelize.query(
      `
        SELECT id, item_name, item_category_id, sku_unit
        FROM Stocks
      `,
    );

    for (const stock of stockRows || []) {
      const itemMasterId = await ensureItemMaster({
        rawName: stock.item_name,
        aliasText: stock.item_name,
        itemCategoryId: stock.item_category_id,
        skuUnit: stock.sku_unit,
      });
      if (!itemMasterId) continue;
      await queryInterface.sequelize.query(
        `
          UPDATE Stocks
          SET item_master_id = :itemMasterId
          WHERE id = :stockId
        `,
        {
          replacements: {
            itemMasterId,
            stockId: Number(stock.id),
          },
        },
      );
    }

    await queryInterface.sequelize.query(
      `
        UPDATE DayBookItems d
        INNER JOIN Stocks s
          ON s.id = d.stock_id
        SET d.item_master_id = s.item_master_id
        WHERE d.item_master_id IS NULL
          AND s.item_master_id IS NOT NULL
      `,
    );

    const [remainingDayBookItems] = await queryInterface.sequelize.query(
      `
        SELECT id, item_name, item_category_id, sku_unit
        FROM DayBookItems
        WHERE item_master_id IS NULL
      `,
    );
    for (const item of remainingDayBookItems || []) {
      const itemMasterId = await ensureItemMaster({
        rawName: item.item_name,
        aliasText: item.item_name,
        itemCategoryId: item.item_category_id,
        skuUnit: item.sku_unit,
      });
      if (!itemMasterId) continue;
      await queryInterface.sequelize.query(
        `
          UPDATE DayBookItems
          SET item_master_id = :itemMasterId
          WHERE id = :dayBookItemId
        `,
        {
          replacements: {
            itemMasterId,
            dayBookItemId: Number(item.id),
          },
        },
      );
    }

    await queryInterface.sequelize.query(
      `
        UPDATE RequisitionItems r
        INNER JOIN Stocks s
          ON s.id = r.stock_id
        SET r.item_master_id = s.item_master_id
        WHERE r.item_master_id IS NULL
          AND s.item_master_id IS NOT NULL
      `,
    );

    const [remainingReqItems] = await queryInterface.sequelize.query(
      `
        SELECT id, particulars, item_category_id, sku_unit
        FROM RequisitionItems
        WHERE item_master_id IS NULL
      `,
    );
    for (const item of remainingReqItems || []) {
      const itemMasterId = await ensureItemMaster({
        rawName: item.particulars,
        aliasText: item.particulars,
        itemCategoryId: item.item_category_id,
        skuUnit: item.sku_unit,
      });
      if (!itemMasterId) continue;
      await queryInterface.sequelize.query(
        `
          UPDATE RequisitionItems
          SET item_master_id = :itemMasterId
          WHERE id = :requisitionItemId
        `,
        {
          replacements: {
            itemMasterId,
            requisitionItemId: Number(item.id),
          },
        },
      );
    }

    await queryInterface.sequelize.query(
      `
        UPDATE IssuedItems i
        INNER JOIN Stocks s
          ON s.id = i.item_id
        SET i.item_master_id = s.item_master_id
        WHERE i.item_master_id IS NULL
          AND s.item_master_id IS NOT NULL
      `,
    );

    await queryInterface.sequelize.query(
      `
        UPDATE IssuedItems i
        INNER JOIN RequisitionItems r
          ON r.id = i.requisition_item_id
        SET i.item_master_id = r.item_master_id
        WHERE i.item_master_id IS NULL
          AND r.item_master_id IS NOT NULL
      `,
    );

    await queryInterface.sequelize.query(
      `
        UPDATE Assets a
        INNER JOIN Stocks s
          ON s.id = a.stock_id
        SET a.item_master_id = s.item_master_id
        WHERE a.item_master_id IS NULL
          AND s.item_master_id IS NOT NULL
      `,
    );

    await queryInterface.sequelize.query(
      `
        UPDATE Assets a
        INNER JOIN DayBookItems d
          ON d.id = a.daybook_item_id
        SET a.item_master_id = d.item_master_id
        WHERE a.item_master_id IS NULL
          AND d.item_master_id IS NOT NULL
      `,
    );

    await nullifyOrphanForeignKeys(queryInterface, {
      tableName: "Stocks",
      fkColumn: "item_master_id",
      refTableName: "ItemMasters",
      refColumn: "id",
    });
    await nullifyOrphanForeignKeys(queryInterface, {
      tableName: "DayBookItems",
      fkColumn: "item_master_id",
      refTableName: "ItemMasters",
      refColumn: "id",
    });
    await nullifyOrphanForeignKeys(queryInterface, {
      tableName: "RequisitionItems",
      fkColumn: "item_master_id",
      refTableName: "ItemMasters",
      refColumn: "id",
    });
    await nullifyOrphanForeignKeys(queryInterface, {
      tableName: "IssuedItems",
      fkColumn: "item_master_id",
      refTableName: "ItemMasters",
      refColumn: "id",
    });
    await nullifyOrphanForeignKeys(queryInterface, {
      tableName: "Assets",
      fkColumn: "item_master_id",
      refTableName: "ItemMasters",
      refColumn: "id",
    });
    await nullifyOrphanForeignKeys(queryInterface, {
      tableName: "DayBookItems",
      fkColumn: "stock_id",
      refTableName: "Stocks",
      refColumn: "id",
    });
    await nullifyOrphanForeignKeys(queryInterface, {
      tableName: "IssuedItems",
      fkColumn: "item_id",
      refTableName: "Stocks",
      refColumn: "id",
    });

    await addConstraintIfMissing(queryInterface, "Stocks", {
      fields: ["item_master_id"],
      type: "foreign key",
      name: "stocks_item_master_id_fk",
      references: {
        table: "ItemMasters",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    await addConstraintIfMissing(queryInterface, "DayBookItems", {
      fields: ["item_master_id"],
      type: "foreign key",
      name: "daybookitems_item_master_id_fk",
      references: {
        table: "ItemMasters",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    await addConstraintIfMissing(queryInterface, "RequisitionItems", {
      fields: ["item_master_id"],
      type: "foreign key",
      name: "requisitionitems_item_master_id_fk",
      references: {
        table: "ItemMasters",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    await addConstraintIfMissing(queryInterface, "IssuedItems", {
      fields: ["item_master_id"],
      type: "foreign key",
      name: "issueditems_item_master_id_fk",
      references: {
        table: "ItemMasters",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    await addConstraintIfMissing(queryInterface, "Assets", {
      fields: ["item_master_id"],
      type: "foreign key",
      name: "assets_item_master_id_fk",
      references: {
        table: "ItemMasters",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    await addConstraintIfMissing(queryInterface, "DayBookItems", {
      fields: ["stock_id"],
      type: "foreign key",
      name: "daybookitems_stock_id_fk",
      references: {
        table: "Stocks",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    await addConstraintIfMissing(queryInterface, "IssuedItems", {
      fields: ["item_id"],
      type: "foreign key",
      name: "issueditems_item_id_fk",
      references: {
        table: "Stocks",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    await addIndexIfMissing(queryInterface, "Stocks", ["item_master_id", "is_active", "quantity", "id"], {
      name: "idx_stocks_itemmaster_active_qty_id",
    });
    await addIndexIfMissing(queryInterface, "DayBookItems", ["item_master_id", "daybook_id", "id"], {
      name: "idx_daybookitems_itemmaster_daybook_id",
    });
    await addIndexIfMissing(queryInterface, "IssuedItems", ["item_master_id", "date", "id"], {
      name: "idx_issueditems_itemmaster_date_id",
    });
    await addIndexIfMissing(
      queryInterface,
      "RequisitionItems",
      ["item_master_id", "requisition_id", "id"],
      {
        name: "idx_requisitionitems_itemmaster_req_id",
      },
    );
    await addIndexIfMissing(queryInterface, "Assets", ["item_master_id", "status", "is_active", "id"], {
      name: "idx_assets_itemmaster_status_active_id",
    });

    const [existingMovements] = await queryInterface.sequelize.query(
      `
        SELECT COUNT(*) AS c
        FROM StockMovements
      `,
    );
    const movementCount = Number(existingMovements?.[0]?.c || 0);

    if (movementCount === 0) {
      const [openingRows] = await queryInterface.sequelize.query(
        `
          SELECT
            id AS stock_id,
            item_master_id,
            quantity,
            sku_unit
          FROM Stocks
          WHERE item_master_id IS NOT NULL
            AND quantity > 0
            AND is_active = 1
        `,
      );

      if (openingRows.length > 0) {
        const now = new Date();
        const movementRows = openingRows.map((row) => ({
          item_master_id: Number(row.item_master_id),
          stock_id: Number(row.stock_id),
          movement_type: "OPENING_BALANCE",
          qty: Number(row.quantity),
          sku_unit: normalizeSkuUnit(row.sku_unit),
          movement_at: now,
          reference_type: "MIGRATION_BOOTSTRAP",
          reference_id: Number(row.stock_id),
          from_employee_id: null,
          to_employee_id: null,
          performed_by: "System Migration",
          remarks: "Opening snapshot created during item master migration",
          metadata_json: JSON.stringify({
            source: "stocks.quantity",
          }),
          createdAt: now,
          updatedAt: now,
        }));

        await queryInterface.bulkInsert("StockMovements", movementRows);
      }
    }
  },

  async down(queryInterface) {
    await removeConstraintIfExists(queryInterface, "IssuedItems", "issueditems_item_id_fk");
    await removeConstraintIfExists(queryInterface, "DayBookItems", "daybookitems_stock_id_fk");

    await removeConstraintIfExists(queryInterface, "Assets", "assets_item_master_id_fk");
    await removeConstraintIfExists(queryInterface, "IssuedItems", "issueditems_item_master_id_fk");
    await removeConstraintIfExists(
      queryInterface,
      "RequisitionItems",
      "requisitionitems_item_master_id_fk",
    );
    await removeConstraintIfExists(
      queryInterface,
      "DayBookItems",
      "daybookitems_item_master_id_fk",
    );
    await removeConstraintIfExists(queryInterface, "Stocks", "stocks_item_master_id_fk");

    await removeIndexIfExists(queryInterface, "Assets", "idx_assets_itemmaster_status_active_id");
    await removeIndexIfExists(
      queryInterface,
      "RequisitionItems",
      "idx_requisitionitems_itemmaster_req_id",
    );
    await removeIndexIfExists(queryInterface, "IssuedItems", "idx_issueditems_itemmaster_date_id");
    await removeIndexIfExists(
      queryInterface,
      "DayBookItems",
      "idx_daybookitems_itemmaster_daybook_id",
    );
    await removeIndexIfExists(queryInterface, "Stocks", "idx_stocks_itemmaster_active_qty_id");

    await removeColumnIfExists(queryInterface, "Assets", "item_master_id");
    await removeColumnIfExists(queryInterface, "IssuedItems", "item_master_id");
    await removeColumnIfExists(queryInterface, "RequisitionItems", "item_master_id");
    await removeColumnIfExists(queryInterface, "DayBookItems", "item_master_id");
    await removeColumnIfExists(queryInterface, "Stocks", "item_master_id");

    if (await hasTable(queryInterface, "StockMovements")) {
      await queryInterface.dropTable("StockMovements");
    }
    if (await hasTable(queryInterface, "ItemMasterAliases")) {
      await queryInterface.dropTable("ItemMasterAliases");
    }
    if (await hasTable(queryInterface, "ItemMasters")) {
      await queryInterface.dropTable("ItemMasters");
    }
  },
};