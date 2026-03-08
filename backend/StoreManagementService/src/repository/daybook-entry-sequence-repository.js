const { DayBookEntrySequence } = require("../models");

class DayBookEntrySequenceRepository {
  constructor(model) {
    this.model = model;
  }

  async getNextNumber(entryType, finYear, transaction) {
    // 1️⃣ Try to lock existing row
    let row = await DayBookEntrySequence.findOne({
      where: { entry_type: entryType, fin_year: finYear },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    // 2️⃣ If not exists, create it safely
    if (!row) {
      row = await DayBookEntrySequence.create(
        {
          entry_type: entryType,
          fin_year: finYear,
          last_number: 0,
        },
        { transaction },
      );
    }

    // 3️⃣ Increment
    const nextNumber = row.last_number + 1;

    await row.update({ last_number: nextNumber }, { transaction });

    return nextNumber;
  }
}

module.exports = DayBookEntrySequenceRepository;
