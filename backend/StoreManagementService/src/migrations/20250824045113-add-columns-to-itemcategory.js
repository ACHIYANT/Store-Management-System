"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(q, S) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await q.addColumn("ItemCategories", "serialized_required", {
      type: S.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await q.addIndex("ItemCategories", ["serialized_required"]);
  },

  async down(q, S) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */

    await q.removeColumn("ItemCategories", "serialized_required");
  },
};
