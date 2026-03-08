"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex("Vendors", ["id"], {
      name: "idx_vendors_id_desc",
    });
    await queryInterface.addIndex("Vendors", ["name"], {
      name: "idx_vendors_name",
    });

    await queryInterface.addIndex("Employees", ["emp_id"], {
      name: "idx_employees_emp_id_desc",
    });
    await queryInterface.addIndex("Employees", ["name"], {
      name: "idx_employees_name",
    });

    await queryInterface.addIndex("ItemCategories", ["category_name", "id"], {
      name: "idx_itemcategories_categoryname_id",
    });
    await queryInterface.addIndex(
      "ItemCategories",
      ["group_id", "serialized_required", "category_name", "id"],
      {
        name: "idx_itemcategories_group_serialized_category_id",
      },
    );

    await queryInterface.addIndex("Stocks", ["item_category_id", "is_active", "id"], {
      name: "idx_stocks_category_active_id",
    });
    await queryInterface.addIndex("Stocks", ["item_category_id", "is_active", "item_name", "id"], {
      name: "idx_stocks_category_active_itemname_id",
    });

    await queryInterface.addIndex("IssuedItems", ["date", "id"], {
      name: "idx_issueditems_date_id",
    });
    await queryInterface.addIndex("IssuedItems", ["employee_id", "date", "id"], {
      name: "idx_issueditems_employee_date_id",
    });
    await queryInterface.addIndex("IssuedItems", ["item_id", "date", "id"], {
      name: "idx_issueditems_item_date_id",
    });

    await queryInterface.addIndex("Assets", ["is_active", "createdAt", "id"], {
      name: "idx_assets_active_createdat_id",
    });
    await queryInterface.addIndex("Assets", ["status", "is_active", "createdAt", "id"], {
      name: "idx_assets_status_active_createdat_id",
    });
    await queryInterface.addIndex(
      "Assets",
      ["item_category_id", "is_active", "createdAt", "id"],
      {
        name: "idx_assets_category_active_createdat_id",
      },
    );
    await queryInterface.addIndex(
      "Assets",
      ["current_employee_id", "is_active", "createdAt", "id"],
      {
        name: "idx_assets_employee_active_createdat_id",
      },
    );
    await queryInterface.addIndex("Assets", ["stock_id", "status", "is_active", "id"], {
      name: "idx_assets_stock_status_active_id",
    });

    await queryInterface.addIndex("AssetEvents", ["event_date", "id"], {
      name: "idx_assetevents_eventdate_id",
    });
    await queryInterface.addIndex("AssetEvents", ["event_type", "event_date", "id"], {
      name: "idx_assetevents_eventtype_eventdate_id",
    });
    await queryInterface.addIndex("AssetEvents", ["asset_id", "event_date", "id"], {
      name: "idx_assetevents_asset_eventdate_id",
    });
    await queryInterface.addIndex(
      "AssetEvents",
      ["from_employee_id", "event_date", "id"],
      {
        name: "idx_assetevents_fromemp_eventdate_id",
      },
    );
    await queryInterface.addIndex("AssetEvents", ["to_employee_id", "event_date", "id"], {
      name: "idx_assetevents_toemp_eventdate_id",
    });
    await queryInterface.addIndex("AssetEvents", ["daybook_id", "event_date", "id"], {
      name: "idx_assetevents_daybook_eventdate_id",
    });
    await queryInterface.addIndex(
      "AssetEvents",
      ["issued_item_id", "event_date", "id"],
      {
        name: "idx_assetevents_issueditem_eventdate_id",
      },
    );

    await queryInterface.addIndex("GatePasses", ["issued_at", "id"], {
      name: "idx_gatepasses_issuedat_id",
    });
    await queryInterface.addIndex("GatePasses", ["status", "issued_at", "id"], {
      name: "idx_gatepasses_status_issuedat_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("GatePasses", "idx_gatepasses_status_issuedat_id");
    await queryInterface.removeIndex("GatePasses", "idx_gatepasses_issuedat_id");

    await queryInterface.removeIndex("AssetEvents", "idx_assetevents_issueditem_eventdate_id");
    await queryInterface.removeIndex("AssetEvents", "idx_assetevents_daybook_eventdate_id");
    await queryInterface.removeIndex("AssetEvents", "idx_assetevents_toemp_eventdate_id");
    await queryInterface.removeIndex("AssetEvents", "idx_assetevents_fromemp_eventdate_id");
    await queryInterface.removeIndex("AssetEvents", "idx_assetevents_asset_eventdate_id");
    await queryInterface.removeIndex("AssetEvents", "idx_assetevents_eventtype_eventdate_id");
    await queryInterface.removeIndex("AssetEvents", "idx_assetevents_eventdate_id");

    await queryInterface.removeIndex("Assets", "idx_assets_stock_status_active_id");
    await queryInterface.removeIndex("Assets", "idx_assets_employee_active_createdat_id");
    await queryInterface.removeIndex("Assets", "idx_assets_category_active_createdat_id");
    await queryInterface.removeIndex("Assets", "idx_assets_status_active_createdat_id");
    await queryInterface.removeIndex("Assets", "idx_assets_active_createdat_id");

    await queryInterface.removeIndex("IssuedItems", "idx_issueditems_item_date_id");
    await queryInterface.removeIndex("IssuedItems", "idx_issueditems_employee_date_id");
    await queryInterface.removeIndex("IssuedItems", "idx_issueditems_date_id");

    await queryInterface.removeIndex("Stocks", "idx_stocks_category_active_itemname_id");
    await queryInterface.removeIndex("Stocks", "idx_stocks_category_active_id");

    await queryInterface.removeIndex(
      "ItemCategories",
      "idx_itemcategories_group_serialized_category_id",
    );
    await queryInterface.removeIndex("ItemCategories", "idx_itemcategories_categoryname_id");

    await queryInterface.removeIndex("Employees", "idx_employees_name");
    await queryInterface.removeIndex("Employees", "idx_employees_emp_id_desc");

    await queryInterface.removeIndex("Vendors", "idx_vendors_name");
    await queryInterface.removeIndex("Vendors", "idx_vendors_id_desc");
  },
};

