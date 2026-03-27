"use strict";

const {
  ASSET_EVENT_TABLE,
  ASSET_TABLE,
  DAYBOOK_TABLE,
  GATE_PASS_TABLE,
  ISSUED_ITEM_TABLE,
  REQUISITION_TABLE,
  STOCK_MOVEMENT_TABLE,
  STOCK_TABLE,
} = require("../constants/table-names");

const LOCATION_COLUMN = "location_scope";
const LOCATION_COLUMN_DEF = {
  type: require("sequelize").STRING(80),
  allowNull: true,
};

const TABLES = [
  DAYBOOK_TABLE,
  STOCK_TABLE,
  REQUISITION_TABLE,
  ISSUED_ITEM_TABLE,
  ASSET_TABLE,
  ASSET_EVENT_TABLE,
  GATE_PASS_TABLE,
  STOCK_MOVEMENT_TABLE,
];

const INDEX_DEFS = [
  {
    table: DAYBOOK_TABLE,
    fields: [LOCATION_COLUMN, "status", "approval_level"],
    name: "idx_daybooks_location_scope_status_level",
  },
  {
    table: STOCK_TABLE,
    fields: [LOCATION_COLUMN, "is_active", "item_category_id"],
    name: "idx_stocks_location_scope_active_category",
  },
  {
    table: REQUISITION_TABLE,
    fields: [LOCATION_COLUMN, "status", "current_stage_order"],
    name: "idx_requisitions_location_scope_status_stage",
  },
  {
    table: ISSUED_ITEM_TABLE,
    fields: [LOCATION_COLUMN, "date"],
    name: "idx_issueditems_location_scope_date",
  },
  {
    table: ASSET_TABLE,
    fields: [LOCATION_COLUMN, "status"],
    name: "idx_assets_location_scope_status",
  },
  {
    table: ASSET_EVENT_TABLE,
    fields: [LOCATION_COLUMN, "event_date"],
    name: "idx_assetevents_location_scope_event_date",
  },
  {
    table: GATE_PASS_TABLE,
    fields: [LOCATION_COLUMN, "status"],
    name: "idx_gatepasses_location_scope_status",
  },
  {
    table: STOCK_MOVEMENT_TABLE,
    fields: [LOCATION_COLUMN, "movement_at"],
    name: "idx_stockmovements_location_scope_movement_at",
  },
];

const addColumnIfMissing = async (queryInterface, tableName) => {
  const definition = await queryInterface.describeTable(tableName);
  if (!definition[LOCATION_COLUMN]) {
    await queryInterface.addColumn(tableName, LOCATION_COLUMN, LOCATION_COLUMN_DEF);
  }
};

const removeColumnIfPresent = async (queryInterface, tableName) => {
  const definition = await queryInterface.describeTable(tableName);
  if (definition[LOCATION_COLUMN]) {
    await queryInterface.removeColumn(tableName, LOCATION_COLUMN);
  }
};

const addIndexIfMissing = async (queryInterface, { table, fields, name }) => {
  const existingIndexes = await queryInterface.showIndex(table);
  if (existingIndexes.some((index) => index.name === name)) return;
  await queryInterface.addIndex(table, fields, { name });
};

const removeIndexIfPresent = async (queryInterface, { table, name }) => {
  const existingIndexes = await queryInterface.showIndex(table);
  if (!existingIndexes.some((index) => index.name === name)) return;
  await queryInterface.removeIndex(table, name);
};

const runBackfillQueries = async (queryInterface) => {
  const { sequelize } = queryInterface;

  await sequelize.query(`
    UPDATE ${REQUISITION_TABLE} r
    LEFT JOIN Employees e
      ON e.emp_id = CAST(r.requester_emp_id AS UNSIGNED)
    SET r.${LOCATION_COLUMN} = UPPER(TRIM(e.office_location))
    WHERE (r.${LOCATION_COLUMN} IS NULL OR TRIM(r.${LOCATION_COLUMN}) = '')
      AND e.office_location IS NOT NULL
      AND TRIM(e.office_location) <> '';
  `);

  await sequelize.query(`
    UPDATE ${ISSUED_ITEM_TABLE} i
    LEFT JOIN Employees e
      ON e.emp_id = i.employee_id
    LEFT JOIN Custodians c
      ON c.id = i.custodian_id
    SET i.${LOCATION_COLUMN} = UPPER(TRIM(COALESCE(e.office_location, c.location)))
    WHERE (i.${LOCATION_COLUMN} IS NULL OR TRIM(i.${LOCATION_COLUMN}) = '')
      AND COALESCE(e.office_location, c.location) IS NOT NULL
      AND TRIM(COALESCE(e.office_location, c.location)) <> '';
  `);

  await sequelize.query(`
    UPDATE ${STOCK_TABLE} s
    LEFT JOIN DayBookItems di
      ON di.stock_id = s.id
    LEFT JOIN ${DAYBOOK_TABLE} d
      ON d.id = di.daybook_id
    SET s.${LOCATION_COLUMN} = d.${LOCATION_COLUMN}
    WHERE (s.${LOCATION_COLUMN} IS NULL OR TRIM(s.${LOCATION_COLUMN}) = '')
      AND d.${LOCATION_COLUMN} IS NOT NULL
      AND TRIM(d.${LOCATION_COLUMN}) <> '';
  `);

  await sequelize.query(`
    UPDATE ${ASSET_TABLE} a
    LEFT JOIN ${STOCK_TABLE} s
      ON s.id = a.stock_id
    LEFT JOIN ${DAYBOOK_TABLE} d
      ON d.id = a.daybook_id
    LEFT JOIN Employees e
      ON e.emp_id = a.current_employee_id
    LEFT JOIN Custodians c
      ON c.id = a.custodian_id
    SET a.${LOCATION_COLUMN} = UPPER(
      TRIM(COALESCE(a.${LOCATION_COLUMN}, s.${LOCATION_COLUMN}, d.${LOCATION_COLUMN}, e.office_location, c.location))
    )
    WHERE (a.${LOCATION_COLUMN} IS NULL OR TRIM(a.${LOCATION_COLUMN}) = '')
      AND COALESCE(s.${LOCATION_COLUMN}, d.${LOCATION_COLUMN}, e.office_location, c.location) IS NOT NULL
      AND TRIM(COALESCE(s.${LOCATION_COLUMN}, d.${LOCATION_COLUMN}, e.office_location, c.location)) <> '';
  `);

  await sequelize.query(`
    UPDATE ${ASSET_EVENT_TABLE} ev
    LEFT JOIN ${ASSET_TABLE} a
      ON a.id = ev.asset_id
    LEFT JOIN Employees fe
      ON fe.emp_id = ev.from_employee_id
    LEFT JOIN Employees te
      ON te.emp_id = ev.to_employee_id
    LEFT JOIN Custodians c
      ON c.id = ev.custodian_id
    LEFT JOIN Custodians fc
      ON fc.id = ev.from_custodian_id
    LEFT JOIN Custodians tc
      ON tc.id = ev.to_custodian_id
    SET ev.${LOCATION_COLUMN} = UPPER(
      TRIM(COALESCE(a.${LOCATION_COLUMN}, c.location, tc.location, fc.location, te.office_location, fe.office_location))
    )
    WHERE (ev.${LOCATION_COLUMN} IS NULL OR TRIM(ev.${LOCATION_COLUMN}) = '')
      AND COALESCE(a.${LOCATION_COLUMN}, c.location, tc.location, fc.location, te.office_location, fe.office_location) IS NOT NULL
      AND TRIM(COALESCE(a.${LOCATION_COLUMN}, c.location, tc.location, fc.location, te.office_location, fe.office_location)) <> '';
  `);

  await sequelize.query(`
    UPDATE ${GATE_PASS_TABLE} gp
    LEFT JOIN GatePassItems gpi
      ON gpi.gate_pass_id = gp.id
    LEFT JOIN ${ASSET_TABLE} a
      ON a.id = gpi.asset_id
    SET gp.${LOCATION_COLUMN} = a.${LOCATION_COLUMN}
    WHERE (gp.${LOCATION_COLUMN} IS NULL OR TRIM(gp.${LOCATION_COLUMN}) = '')
      AND a.${LOCATION_COLUMN} IS NOT NULL
      AND TRIM(a.${LOCATION_COLUMN}) <> '';
  `);

  await sequelize.query(`
    UPDATE ${STOCK_MOVEMENT_TABLE} sm
    LEFT JOIN ${STOCK_TABLE} s
      ON s.id = sm.stock_id
    SET sm.${LOCATION_COLUMN} = s.${LOCATION_COLUMN}
    WHERE (sm.${LOCATION_COLUMN} IS NULL OR TRIM(sm.${LOCATION_COLUMN}) = '')
      AND s.${LOCATION_COLUMN} IS NOT NULL
      AND TRIM(s.${LOCATION_COLUMN}) <> '';
  `);

  const [singleLocationRows] = await sequelize.query(`
    SELECT location_scope
    FROM (
      SELECT DISTINCT UPPER(TRIM(office_location)) AS location_scope
      FROM Employees
      WHERE office_location IS NOT NULL AND TRIM(office_location) <> ''
      UNION
      SELECT DISTINCT UPPER(TRIM(location)) AS location_scope
      FROM Custodians
      WHERE location IS NOT NULL AND TRIM(location) <> ''
    ) AS scoped_locations
    WHERE location_scope IS NOT NULL AND location_scope <> '';
  `);

  if (Array.isArray(singleLocationRows) && singleLocationRows.length === 1) {
    const onlyLocation = String(singleLocationRows[0].location_scope || "").trim();
    if (onlyLocation) {
      for (const tableName of TABLES) {
        await sequelize.query(
          `
            UPDATE ${tableName}
            SET ${LOCATION_COLUMN} = :onlyLocation
            WHERE ${LOCATION_COLUMN} IS NULL OR TRIM(${LOCATION_COLUMN}) = '';
          `,
          {
            replacements: { onlyLocation },
          },
        );
      }
    }
  }
};

module.exports = {
  async up(queryInterface) {
    for (const tableName of TABLES) {
      await addColumnIfMissing(queryInterface, tableName);
    }

    await runBackfillQueries(queryInterface);

    for (const indexDef of INDEX_DEFS) {
      await addIndexIfMissing(queryInterface, indexDef);
    }
  },

  async down(queryInterface) {
    for (const indexDef of INDEX_DEFS) {
      await removeIndexIfPresent(queryInterface, indexDef);
    }

    for (const tableName of [...TABLES].reverse()) {
      await removeColumnIfPresent(queryInterface, tableName);
    }
  },
};
