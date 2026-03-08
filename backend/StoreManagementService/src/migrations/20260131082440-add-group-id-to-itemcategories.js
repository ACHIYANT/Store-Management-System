"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("ItemCategories", "group_id", {
      type: Sequelize.INTEGER,
      allowNull: true, // keep nullable for old data
      references: {
        model: "ItemCategoryGroups",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("ItemCategories", "group_id");
  },
};
