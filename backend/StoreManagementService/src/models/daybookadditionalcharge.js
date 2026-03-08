module.exports = (sequelize, DataTypes) => {
  const DayBookAdditionalCharge = sequelize.define(
    "DayBookAdditionalCharge",
    {
      charge_type: DataTypes.STRING,
      description: DataTypes.STRING,
      quantity: DataTypes.DECIMAL,
      rate: DataTypes.DECIMAL,
      gst_type: DataTypes.ENUM("IGST", "CGST_SGST"),
      gst_rate: DataTypes.DECIMAL,
      gst_amount: DataTypes.DECIMAL,
      total_amount: DataTypes.DECIMAL
    }
  );

  DayBookAdditionalCharge.associate = (models) => {
    DayBookAdditionalCharge.belongsTo(models.DayBook, {
      foreignKey: "daybook_id"
    });
  };

  return DayBookAdditionalCharge;
};
