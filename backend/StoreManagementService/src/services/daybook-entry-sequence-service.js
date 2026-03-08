const DayBookEntrySequenceRepository = require("../repository/daybook-entry-sequence-repository");

class DayBookEntrySequenceService {
  constructor(sequelize) {
    this.sequenceRepository = new DayBookEntrySequenceRepository();
    this.sequelize = sequelize;
  }

  #normalizeEntryType(entryType) {
    const map = {
      "Fixed Assets": "FA",
      "Consumable Items": "CI",
      "Stationary Items": "SI",
      "Vehicle Items": "VI",
      FA: "FA",
      CI: "CI",
      SI: "SI",
      VI: "VI",
    };

    const short = map[entryType];

    if (!short) {
      throw new Error(`Invalid entry_type: ${entryType}`);
    }

    return short;
  }

  async generateNextEntryNo(entryType, finYear, transaction) {
    const shortType = this.#normalizeEntryType(entryType);
    const next = await this.sequenceRepository.getNextNumber(
      shortType,
      finYear,
      transaction,
    );

    const padded = String(next).padStart(2, "0");

    return `${shortType}-${finYear}/${padded}`;
  }
}

module.exports = DayBookEntrySequenceService;
