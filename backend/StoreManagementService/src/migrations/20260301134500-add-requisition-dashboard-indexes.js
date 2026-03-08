"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex(
      "Requisitions",
      ["requester_user_id", "status", "updatedAt", "id"],
      {
        name: "idx_requisitions_requester_status_updatedat_id",
      },
    );

    await queryInterface.addIndex(
      "Requisitions",
      ["requester_user_id", "createdAt", "id"],
      {
        name: "idx_requisitions_requester_createdat_id",
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "Requisitions",
      "idx_requisitions_requester_createdat_id",
    );
    await queryInterface.removeIndex(
      "Requisitions",
      "idx_requisitions_requester_status_updatedat_id",
    );
  },
};

