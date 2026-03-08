"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.bulkInsert("ItemCategories", [
      /* =========================
         STATIONERY → Paper (1)
      ========================= */

      {
        category_name: "A3 Paper Rim",
        group_id: 1,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },

      /* Writing Items (2) */
      {
        category_name: "Blue Gel Pen",
        group_id: 2,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Black Gel Pen",
        group_id: 2,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Uniball blue Pen",
        group_id: 2,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Uniball black Pen",
        group_id: 2,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "V7 blue Pen",
        group_id: 2,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "V5 blue Pen",
        group_id: 2,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "V7 Green Pen",
        group_id: 2,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Pilot Blue Pen",
        group_id: 2,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Highlighter Pen",
        group_id: 2,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Permanent Marker",
        group_id: 2,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },

      /* Files & Folders (3) */
      {
        category_name: "Office File Board",
        group_id: 3,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Spring File",
        group_id: 3,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Ring Binder File",
        group_id: 3,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },

      /* Registers & Notebooks (4) */
      {
        category_name: "Attendance Register",
        group_id: 4,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Stock Register",
        group_id: 4,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Office Notebook",
        group_id: 4,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },

      /* Printing Consumables (5) */
      {
        category_name: "Inkjet Cartridge Black",
        group_id: 5,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Inkjet Cartridge Color",
        group_id: 5,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },

      /* Office Accessories (6) */
      {
        category_name: "Stapler",
        group_id: 6,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Stapler Pin Small",
        group_id: 6,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Stapler Pin Big",
        group_id: 6,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Single Punch",
        group_id: 6,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Double Punch",
        group_id: 6,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "U Clip Box",
        group_id: 6,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },

      /* =========================
         IT EQUIPMENT → Desktop Computers (9)
      ========================= */
      {
        category_name: "Desktop Computer i5",
        group_id: 9,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Desktop Computer i7",
        group_id: 9,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },

      /* Laptops (10) */
      {
        category_name: "Laptop i5 8GB 512GB",
        group_id: 10,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Laptop i7 16GB 1TB",
        group_id: 10,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },

      /* Storage Devices (13) */
      {
        category_name: "External Hard Disk 1TB",
        group_id: 13,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "SSD 512GB",
        group_id: 13,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Pen Drive 64GB",
        group_id: 13,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },

      /* =========================
         ELECTRONICS → Display Devices (23)
      ========================= */
      {
        category_name: "LED TV 43 Inch",
        group_id: 23,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "LED Monitor 24 Inch",
        group_id: 23,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Projector",
        group_id: 23,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },

      /* =========================
         ELECTRICALS → Fans & Ventilation (26)
      ========================= */
      {
        category_name: "Ceiling Fan",
        group_id: 26,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Exhaust Fan",
        group_id: 26,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },

      /* =========================
         FURNITURE → Seating Furniture (33)
      ========================= */
      {
        category_name: "Office Chair Revolving",
        group_id: 33,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Visitor Chair",
        group_id: 33,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },

      /* Storage Furniture (32) */
      {
        category_name: "Steel Almirah",
        group_id: 32,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Wooden Cabinet",
        group_id: 32,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },

      /* =========================
         VEHICLES → Cars (36)
      ========================= */
      {
        category_name: "Office Car Petrol",
        group_id: 36,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Office Car Diesel",
        group_id: 36,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },

      /* =========================
         HOUSEKEEPING → Cleaning Materials (62)
      ========================= */
      {
        category_name: "Phenyl Cleaner",
        group_id: 62,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Floor Cleaner",
        group_id: 62,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Hand Wash Liquid",
        group_id: 62,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },

      /* =========================
         GARDENING → Gardening Tools (68)
      ========================= */
      {
        category_name: "Garden Shovel",
        group_id: 68,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        category_name: "Water Hose Pipe",
        group_id: 68,
        serialized_required: true,
        createdAt: now,
        updatedAt: now,
      },

      /* =========================
         MISCELLANEOUS → Emergency Purchases (85)
      ========================= */
      {
        category_name: "Emergency Office Purchase",
        group_id: 85,
        serialized_required: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("ItemCategories", null, {});
  },
};
