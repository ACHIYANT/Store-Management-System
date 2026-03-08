const {
  DayBookItemSerial,
  DayBookItem,
  ItemCategory,
  DayBook,
  sequelize,
} = require("../models");
const { Op } = require("sequelize");

/**
 * Asset tag format: <CAT>-<YYYY>-<DayBookItemId>-<seq>
 *  - CAT: first 3 alnum chars of category (uppercased, padded)
 *  - YYYY: from purchased_at, else DayBook.bill_date, else current year
 *  - seq: 001.. per daybook_item_id
 */
class DayBookItemSerialRepository {
  #catCode(name = "GEN") {
    const code = String(name)
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    return (code || "GEN").slice(0, 3).padEnd(3, "X");
  }

  async #context(daybook_item_id, t) {
    const item = await DayBookItem.findByPk(daybook_item_id, {
      include: [{ model: ItemCategory }, { model: DayBook }],
      transaction: t,
    });
    if (!item) throw new Error("DayBookItem not found");
    return item;
  }

  async #nextSeq(daybook_item_id, t) {
    const count = await DayBookItemSerial.count({
      where: { daybook_item_id },
      transaction: t,
    });
    return String(count + 1).padStart(3, "0");
  }

  async createOne({
    daybook_item_id,
    serial_number,
    purchased_at,
    warranty_expiry,
    source = "DAYBOOK",
  }) {
    const t = await sequelize.transaction();
    try {
      if (!daybook_item_id || !serial_number) {
        throw new Error("daybook_item_id and serial_number are required");
      }

      const ctx = await this.#context(daybook_item_id, t);
      const year = purchased_at
        ? new Date(purchased_at).getFullYear()
        : ctx.DayBook?.bill_date
          ? new Date(ctx.DayBook.bill_date).getFullYear()
          : new Date().getFullYear();

      const catCode = this.#catCode(ctx.ItemCategory?.category_name);
      const seq = await this.#nextSeq(daybook_item_id, t);
      const asset_tag = `${catCode}-${year}-${daybook_item_id}-${seq}`;

      const row = await DayBookItemSerial.create(
        {
          daybook_item_id,
          serial_number,
          purchased_at: purchased_at || null,
          warranty_expiry: warranty_expiry || null,
          asset_tag,
          source: source || "DAYBOOK",
        },
        { transaction: t },
      );

      await t.commit();
      return row.get({ plain: true });
    } catch (err) {
      await t.rollback();
      console.error("createOne DayBookItemSerial failed:", err);
      throw err;
    }
  }

  /**
   * Upsert an array of serials for a given daybook_item_id.
   * serials: [{ serial_number, purchased_at?, warranty_expiry? }, ...]
   */
  async bulkUpsert(daybook_item_id, serials = [], defaults = {}, transaction) {
    const t = transaction;
    const source = defaults?.source || "DAYBOOK";

    try {
      const results = [];
      for (const s of serials) {
        if (!s?.serial_number) continue;

        //TEMP SERIAL REPLACEMENT (ADD HERE)
        const finalSerial = s.serial_number.startsWith("TMP-")
          ? s.serial_number.replace(/^TMP-/, `${defaults.entry_no}-`)
          : s.serial_number;

        const existing = await DayBookItemSerial.findOne({
          where: { daybook_item_id, serial_number: finalSerial },
          transaction: t,
        });

        if (existing) {
          await existing.update(
            {
              purchased_at:
                s.purchased_at ??
                defaults.purchased_at ??
                existing.purchased_at,
              warranty_expiry:
                s.warranty_expiry ??
                defaults.warranty_expiry ??
                existing.warranty_expiry,
            },
            { transaction: t },
          );
          results.push(existing.get({ plain: true }));
        } else {
          // create within this tx but reuse single-row logic
          const ctx = await this.#context(daybook_item_id, t);
          const year =
            (s.purchased_at ?? defaults.purchased_at)
              ? new Date(s.purchased_at ?? defaults.purchased_at).getFullYear()
              : ctx.DayBook?.bill_date
                ? new Date(ctx.DayBook.bill_date).getFullYear()
                : new Date().getFullYear();
          const catCode = this.#catCode(ctx.ItemCategory?.category_name);
          const seq = await this.#nextSeq(daybook_item_id, t);
          const asset_tag = `${catCode}-${year}-${daybook_item_id}-${seq}`;

          const row = await DayBookItemSerial.create(
            {
              daybook_item_id,
              serial_number: finalSerial,
              purchased_at: s.purchased_at ?? defaults.purchased_at ?? null,
              warranty_expiry:
                s.warranty_expiry ?? defaults.warranty_expiry ?? null,
              asset_tag,
              source,
            },
            { transaction: t },
          );
          results.push(row.get({ plain: true }));
        }
      }

      return results;
    } catch (err) {
      console.error("bulkUpsert DayBookItemSerial failed:", err);
      throw err;
    }
  }

  async findByDayBookItem(daybook_item_id) {
    return DayBookItemSerial.findAll({ where: { daybook_item_id } });
  }

  async markMigratedByIds(ids = []) {
    if (!ids.length) return 0;
    return DayBookItemSerial.update(
      { migrated_at: new Date() },
      { where: { id: ids } },
    );
  }

  async deleteByDayBookItem(daybook_item_id) {
    return DayBookItemSerial.destroy({ where: { daybook_item_id } });
  }

  async deleteByItemIds(itemIds, transaction) {
    if (!itemIds.length) return 0;

    return DayBookItemSerial.destroy({
      where: {
        daybook_item_id: { [Op.in]: itemIds },
      },
      transaction,
    });
  }

  async bulkCreateSerials(serialRows, transaction) {
    if (!serialRows.length) return [];

    const rows = serialRows.map((row) => ({
      ...row,
      source: row?.source || "DAYBOOK",
    }));
    return DayBookItemSerial.bulkCreate(rows, { transaction });
  }
}

module.exports = DayBookItemSerialRepository;
