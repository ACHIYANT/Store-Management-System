"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex("DayBooks", ["createdAt", "id"], {
      name: "idx_daybooks_createdat_id",
    });

    await queryInterface.addIndex("DayBooks", ["approval_level", "createdAt", "id"], {
      name: "idx_daybooks_approval_createdat_id",
    });

    await queryInterface.addIndex("DayBooks", ["status", "createdAt", "id"], {
      name: "idx_daybooks_status_createdat_id",
    });

    await queryInterface.addIndex("DayBooks", ["entry_type", "createdAt", "id"], {
      name: "idx_daybooks_entrytype_createdat_id",
    });

    await queryInterface.addIndex("DayBooks", ["fin_year", "createdAt", "id"], {
      name: "idx_daybooks_finyear_createdat_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("DayBooks", "idx_daybooks_finyear_createdat_id");
    await queryInterface.removeIndex("DayBooks", "idx_daybooks_entrytype_createdat_id");
    await queryInterface.removeIndex("DayBooks", "idx_daybooks_status_createdat_id");
    await queryInterface.removeIndex("DayBooks", "idx_daybooks_approval_createdat_id");
    await queryInterface.removeIndex("DayBooks", "idx_daybooks_createdat_id");
  },
};
