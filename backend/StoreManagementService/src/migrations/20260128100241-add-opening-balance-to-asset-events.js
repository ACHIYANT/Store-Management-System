"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE AssetEvents 
      MODIFY COLUMN event_type ENUM(
        'Created',
        'OpeningBalance',
        'Issued',
        'Returned',
        'Transferred',
        'SubmittedToStore',
        'RepairOut',
        'RepairIn',
        'Adjusted',
        'Disposed',
        'Lost'
      ) NOT NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE AssetEvents 
      MODIFY COLUMN event_type ENUM(
        'Created',
        'Issued',
        'Returned',
        'Transferred',
        'SubmittedToStore',
        'RepairOut',
        'RepairIn',
        'Adjusted',
        'Disposed',
        'Lost'
      ) NOT NULL;
    `);
  }
};