module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("DayBookAdditionalCharges", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      daybook_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "DayBooks",
          key: "id"
        },
        onDelete: "CASCADE"
      },
      charge_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.STRING
      },
      quantity: {
        type: Sequelize.DECIMAL(10,2),
        defaultValue: 1
      },
      rate: {
        type: Sequelize.DECIMAL(10,2),
        allowNull: false
      },
      gst_type: {
        type: Sequelize.ENUM("IGST", "CGST_SGST"),
        allowNull: false
      },
      gst_rate: {
        type: Sequelize.DECIMAL(5,2),
        allowNull: false
      },
      gst_amount: {
        type: Sequelize.DECIMAL(10,2),
        allowNull: false
      },
      total_amount: {
        type: Sequelize.DECIMAL(10,2),
        allowNull: false
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("DayBookAdditionalCharges");
  }
};
