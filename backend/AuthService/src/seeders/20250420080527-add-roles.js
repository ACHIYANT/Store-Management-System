"use strict";
const { ROLE_TABLE } = require("../constants/table-names");

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
      ROLE_TABLE,
      [
        {
          name: "ADMIN",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "ADMIN_APPROVER",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "ACCTS_APPROVER",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "PROC_APPROVER",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "INSPECTION_OFFICER",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "USER",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "STORE_ENTRY",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: "SUPER_ADMIN",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {},
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
