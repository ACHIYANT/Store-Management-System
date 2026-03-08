"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("DayBooks", "created_by_user_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn("DayBooks", "approved_by_user_ids", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addIndex(
      "DayBooks",
      ["created_by_user_id", "createdAt", "id"],
      {
        name: "idx_daybooks_creator_createdat_id",
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("DayBooks", "idx_daybooks_creator_createdat_id");
    await queryInterface.removeColumn("DayBooks", "approved_by_user_ids");
    await queryInterface.removeColumn("DayBooks", "created_by_user_id");
  },
};

