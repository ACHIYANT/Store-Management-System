const { DayBookItemSerialRepository } = require("../repository/index");

class DayBookItemSerialService {
  constructor() {
    this.repo = new DayBookItemSerialRepository();
  }
  async bulkUpsertAll(createdItems, serials, transaction, entryNo) {
    for (const item of createdItems) {
      // 🔒 SAFETY CHECKS
      if (!item?.id || item.temp_id === null || item.temp_id === undefined) {
        continue;
      }

      // 🔗 MAP serials using temp_id
      const itemSerials = serials.filter(
        (s) => Number(s.daybook_item_temp_id) === Number(item.temp_id),
      );

      if (!itemSerials.length) continue;

      await this.repo.bulkUpsert(
        item.id,
        itemSerials,
        {
          entry_no: entryNo,
          source: "DAYBOOK",
        },
        transaction,
      );
    }
  }

  async createOne(data) {
    try {
      // data: { daybook_item_id, serial_number, purchased_at?, warranty_expiry? }
      // asset_tag is auto-generated in the repository
      return await this.repo.createOne(data);
    } catch (error) {
      console.log("Something went wrong at service layer (createOne).");
      throw { error };
    }
  }

  async bulkUpsert(daybook_item_id, serials, defaults = {}, transaction) {
    try {
      // serials: [{ serial_number, purchased_at?, warranty_expiry? }, ...]
      return await this.repo.bulkUpsert(
        daybook_item_id,
        serials,
        defaults,
        transaction,
      );
    } catch (error) {
      console.log("Something went wrong at service layer (bulkUpsert).");
      throw { error };
    }
  }

  async findByDayBookItem(daybook_item_id) {
    try {
      return await this.repo.findByDayBookItem(daybook_item_id);
    } catch (error) {
      console.log("Something went wrong at service layer (findByDayBookItem).");
      throw { error };
    }
  }

  async markMigratedByIds(ids) {
    try {
      return await this.repo.markMigratedByIds(ids);
    } catch (error) {
      console.log("Something went wrong at service layer (markMigratedByIds).");
      throw { error };
    }
  }

  async deleteByDayBookItem(daybook_item_id) {
    try {
      return await this.repo.deleteByDayBookItem(daybook_item_id);
    } catch (error) {
      console.log(
        "Something went wrong at service layer (deleteByDayBookItem).",
      );
      throw { error };
    }
  }
}

module.exports = DayBookItemSerialService;
