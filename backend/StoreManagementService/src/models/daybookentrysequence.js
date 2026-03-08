"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class DayBookEntrySequence extends Model {}

  DayBookEntrySequence.init(
    {
      entry_type: {
        type: DataTypes.ENUM("FA", "CI", "SI", "VI"),
        allowNull: false,
      },
      fin_year: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      last_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: "DayBookEntrySequence",
      tableName: "DayBookEntrySequences",
    }
  );

  return DayBookEntrySequence;
};
