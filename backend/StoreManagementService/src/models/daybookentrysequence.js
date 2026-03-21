"use strict";
const { Model } = require("sequelize");
const { DAYBOOK_ENTRY_SEQUENCE_TABLE } = require("../constants/table-names");

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
      tableName: DAYBOOK_ENTRY_SEQUENCE_TABLE,
    }
  );

  return DayBookEntrySequence;
};
