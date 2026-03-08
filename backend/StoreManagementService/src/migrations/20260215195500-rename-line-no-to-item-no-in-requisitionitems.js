"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("RequisitionItems");
    if (table?.line_no && !table?.item_no) {
      await queryInterface.renameColumn("RequisitionItems", "line_no", "item_no");
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("RequisitionItems");
    if (table?.item_no && !table?.line_no) {
      await queryInterface.renameColumn("RequisitionItems", "item_no", "line_no");
    }
  },
};
