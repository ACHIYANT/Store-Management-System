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
      "Vendors",
      [
        {
          name: "Alpha Traders",
          address: "12 Industrial Area, Sector 20",
          gst_no: "ABCDEF12345678Z",
          mobile_no: "9876543210",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Bright Supplies",
          address: "45 Market Road, New Town",
          gst_no: "XYSUPL67891234A",
          mobile_no: "9123456789",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "City Electric",
          address: "78 Electric Lane, Zone B",
          gst_no: "ELECTR99887766B",
          mobile_no: "9988776655",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Delta Hardware",
          address: "9 Construction Street, Unit 3",
          gst_no: "DELTAH12349876C",
          mobile_no: "9654321876",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "Eastern Tools",
          address: "123 Tool Bazaar, Old City",
          gst_no: "TOOLBX12983476D",
          mobile_no: "9765432187",
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
