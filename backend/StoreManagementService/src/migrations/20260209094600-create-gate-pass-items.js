"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("GatePassItems", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      gate_pass_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "GatePasses",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      asset_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Assets",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      asset_tag_snapshot: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      serial_number_snapshot: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      out_verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      out_verified_by: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      in_verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      in_verified_by: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("GatePassItems", ["gate_pass_id"]);
    await queryInterface.addIndex("GatePassItems", ["asset_id"]);
    await queryInterface.addIndex("GatePassItems", ["out_verified_at"]);
    await queryInterface.addIndex("GatePassItems", ["in_verified_at"]);
    await queryInterface.addConstraint("GatePassItems", {
      fields: ["gate_pass_id", "asset_id"],
      type: "unique",
      name: "uq_gate_pass_items_gate_pass_asset",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("GatePassItems");
  },
};
