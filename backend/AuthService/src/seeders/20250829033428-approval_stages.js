// authservice/src/seeders/20250829033428-approval_stages.js
"use strict";

module.exports = {
  async up(qi) {
    const now = new Date();
    await qi.bulkInsert("approval_stages", [
      {
        role_name: "ADMIN_APPROVER",
        stage_order: 1,
        flow_type: "DAYBOOK",
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        role_name: "INSPECTION_OFFICER",
        stage_order: 2,
        flow_type: "DAYBOOK",
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        role_name: "PROC_APPROVER",
        stage_order: 3,
        flow_type: "DAYBOOK",
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        role_name: "ACCTS_APPROVER",
        stage_order: 4,
        flow_type: "DAYBOOK",
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(qi) {
    await qi.bulkDelete("approval_stages", null, {});
  },
};
