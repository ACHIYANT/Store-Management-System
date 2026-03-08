"use strict";

const OLD_TYPES = [
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
];

const NEW_TYPES = [...OLD_TYPES, "LOST_OUT", "RETAIN_OUT"];

function toEnumList(values) {
  return values.map((value) => `'${value}'`).join(", ");
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE StockMovements
      MODIFY COLUMN movement_type ENUM(${toEnumList(NEW_TYPES)}) NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE StockMovements
      SET movement_type = 'DISPOSE_OUT'
      WHERE movement_type IN ('LOST_OUT', 'RETAIN_OUT');
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE StockMovements
      MODIFY COLUMN movement_type ENUM(${toEnumList(OLD_TYPES)}) NOT NULL;
    `);
  },
};

