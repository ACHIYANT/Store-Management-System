const { DayBookItemSerialRepository } = require("../repository/index");
const { DayBookItemSerial, DayBookItem, DayBook } = require("../models");
const { assertActorCanAccessLocation } = require("../utils/location-scope");

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

  async createOne(data, actor = null) {
    try {
      await this.assertActorCanAccessDaybookItem(
        data?.daybook_item_id,
        actor,
        "add serials for this daybook item",
      );
      // data: { daybook_item_id, serial_number, purchased_at?, warranty_expiry? }
      // asset_tag is auto-generated in the repository
      return await this.repo.createOne(data);
    } catch (error) {
      console.log("Something went wrong at service layer (createOne).");
      throw { error };
    }
  }

  async bulkUpsert(
    daybook_item_id,
    serials,
    defaults = {},
    transaction,
    actor = null,
  ) {
    try {
      await this.assertActorCanAccessDaybookItem(
        daybook_item_id,
        actor,
        "update serials for this daybook item",
      );
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

  async findByDayBookItem(daybook_item_id, actor = null) {
    try {
      await this.assertActorCanAccessDaybookItem(
        daybook_item_id,
        actor,
        "view serials for this daybook item",
      );
      return await this.repo.findByDayBookItem(daybook_item_id);
    } catch (error) {
      console.log("Something went wrong at service layer (findByDayBookItem).");
      throw { error };
    }
  }

  async markMigratedByIds(ids, actor = null) {
    try {
      await this.assertActorCanAccessSerialIds(
        ids,
        actor,
        "mark serials as migrated",
      );
      return await this.repo.markMigratedByIds(ids);
    } catch (error) {
      console.log("Something went wrong at service layer (markMigratedByIds).");
      throw { error };
    }
  }

  async deleteByDayBookItem(daybook_item_id, actor = null) {
    try {
      await this.assertActorCanAccessDaybookItem(
        daybook_item_id,
        actor,
        "delete serials for this daybook item",
      );
      return await this.repo.deleteByDayBookItem(daybook_item_id);
    } catch (error) {
      console.log(
        "Something went wrong at service layer (deleteByDayBookItem).",
      );
      throw { error };
    }
  }

  async assertActorCanAccessDaybookItem(
    daybook_item_id,
    actor = null,
    action = "access this daybook item",
  ) {
    if (!actor || daybook_item_id == null) return null;

    const item = await DayBookItem.findByPk(daybook_item_id, {
      attributes: ["id", "daybook_id"],
      include: [
        {
          model: DayBook,
          attributes: ["id", "location_scope"],
        },
      ],
    });

    if (!item) {
      const error = new Error("DayBookItem not found");
      error.statusCode = 404;
      throw error;
    }

    assertActorCanAccessLocation(actor, item.DayBook?.location_scope, action);
    return item;
  }

  async assertActorCanAccessSerialIds(
    ids = [],
    actor = null,
    action = "access these serials",
  ) {
    if (!actor || !Array.isArray(ids) || ids.length === 0) return;

    const serials = await DayBookItemSerial.findAll({
      where: { id: ids },
      attributes: ["id"],
      include: [
        {
          model: DayBookItem,
          attributes: ["id"],
          include: [
            {
              model: DayBook,
              attributes: ["id", "location_scope"],
            },
          ],
        },
      ],
    });

    for (const serial of serials) {
      assertActorCanAccessLocation(
        actor,
        serial.DayBookItem?.DayBook?.location_scope,
        action,
      );
    }
  }
}

module.exports = DayBookItemSerialService;
