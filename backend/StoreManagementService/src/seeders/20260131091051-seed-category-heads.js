"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert(
      "ItemCategoryHeads",
      [
        {
          category_head_name: "Stationery",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "IT Equipment",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Electronics",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Electricals",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Furniture",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Vehicles",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Machinery",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Tools & Hardware",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Power & Backup",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Security Systems",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Housekeeping",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Gardening",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Spares",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Laboratory Equipment",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Medical Equipment",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          category_head_name: "Miscellaneous",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {},
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("ItemCategoryHeads", null, {});
  },
};
