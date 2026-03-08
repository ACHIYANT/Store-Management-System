"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     */

    await queryInterface.bulkInsert(
      "DayBooks",
      [
       
        {
          entry_no: "FA-2025/199",
          entry_type: "Fixed Assets",
          bill_no: "BILL005",
          bill_date: "2025-04-22",
          vendor_id: 22,
          total_amount: 12000.0,
          bill_image_url: "https://example.com/bill005.jpg",
          item_image_url: "https://example.com/item005.jpg",
          approval_level: 0,
          fin_year: 2025,
          remarks: "Monthly cleaning supplies",
          status: "Pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  },
};
