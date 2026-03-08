"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE RequisitionActions
      MODIFY COLUMN action ENUM(
        'Create',
        'Submit',
        'Approve',
        'Forward',
        'Reject',
        'QtyReduce',
        'Cancel',
        'Fulfill',
        'MapItem'
      ) NOT NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE RequisitionActions
      SET action = 'Forward'
      WHERE action = 'MapItem';
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE RequisitionActions
      MODIFY COLUMN action ENUM(
        'Create',
        'Submit',
        'Approve',
        'Forward',
        'Reject',
        'QtyReduce',
        'Cancel',
        'Fulfill'
      ) NOT NULL;
    `);
  },
};
