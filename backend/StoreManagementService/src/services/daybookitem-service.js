const { DayBookItemRepository } = require("../repository/index");
const { sequelize } = require("../models");
const DayBookAdditionalChargeRepository = require("../repository/daybook-additional-charge-repository");
const DayBookItemSerialRepository = require("../repository/daybookitemserials-repository");
const { normalizeSkuUnit } = require("../utils/sku-units");
const { assertActorCanAccessLocation } = require("../utils/location-scope");

const { DayBook } = require("../models");

class DayBookItemService {
  constructor() {
    this.dayBookItemRepository = new DayBookItemRepository();
    this.dayBookItemSerialRepository = new DayBookItemSerialRepository();
    this.dayBookAdditionalChargeRepository =
      new DayBookAdditionalChargeRepository();
  }
  calculateAmount({ quantity, rate, gst_type, gst_rate }) {
    const baseAmount = quantity * rate;
    const gstMultiplier = gst_rate / 100;

    let gstAmount = 0;
    if (gst_type === "IGST") {
      gstAmount = baseAmount * gstMultiplier;
    } else if (gst_type === "CGST_SGST") {
      // Split equally between CGST and SGST
      gstAmount = baseAmount * gstMultiplier;
    }

    const total = baseAmount + gstAmount;
    return total.toFixed(2);
  }

  async createItemsForDayBook(daybookId, items) {
    try {
      const enrichedItems = items.map((item) => ({
        ...item,
        sku_unit: normalizeSkuUnit(item?.sku_unit),
        daybook_id: daybookId,
        amount: this.calculateAmount(item),
      }));

      return await this.dayBookItemRepository.bulkCreate(enrichedItems);
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }

  async createItemsAndCharges(
    daybookId,
    items,
    additionalCharges = [],
    transaction,
    actor = null,
  ) {
    try {
      if (actor) {
        await this.assertActorCanAccessDaybook(
          daybookId,
          actor,
          "add items to this daybook",
          transaction,
        );
      }

      /* ----------------------
       1. SAVE ITEMS
    ---------------------- */
      const enrichedItems = items.map((item, index) => ({
        ...item,
        sku_unit: normalizeSkuUnit(item?.sku_unit),
        daybook_id: daybookId,
        amount: this.calculateAmount(item),
        // 🔑 ADD THIS
        temp_id: index,
      }));

      const createdItems = await this.dayBookItemRepository.bulkCreate(
        enrichedItems,
        { transaction },
      );

      /* ----------------------
       2. SAVE ADDITIONAL CHARGES (OPTIONAL)
    ---------------------- */
      if (Array.isArray(additionalCharges) && additionalCharges.length > 0) {
        const chargeRepo = new DayBookAdditionalChargeRepository();

        await chargeRepo.bulkCreate(
          additionalCharges.map((c) => {
            const qty = Number(c.quantity) || 0;
            const rate = Number(c.rate) || 0;
            const gstRate = Number(c.gst_rate) || 0;

            const baseAmount = qty * rate;
            const gstAmount = baseAmount * (gstRate / 100);
            const totalAmount = baseAmount + gstAmount;

            return {
              daybook_id: daybookId,
              charge_type: c.charge_type,
              description: c.description || null,
              quantity: qty,
              rate: rate,
              gst_type: c.gst_type,
              gst_rate: gstRate,
              gst_amount: gstAmount.toFixed(2),
              total_amount: totalAmount.toFixed(2),
            };
          }),
          transaction,
        );
      }

      /* ----------------------
       3. TOTAL VALIDATION
    ---------------------- */
      const daybook = await DayBook.findByPk(daybookId, { transaction });

      let calculatedTotal = 0;

      // Items
      enrichedItems.forEach((i) => {
        calculatedTotal += Number(i.amount);
      });

      // Charges (only if present)
      additionalCharges.forEach((c) => {
        const base = Number(c.quantity) * Number(c.rate);
        const gst = base * (Number(c.gst_rate) / 100);
        calculatedTotal += base + gst;
      });

      if (Math.abs(calculatedTotal - Number(daybook.total_amount)) > 1) {
        throw new Error(
          `Total mismatch. Bill: ${daybook.total_amount}, Calculated: ${calculatedTotal}`,
        );
      }

      return createdItems;
    } catch (error) {
      throw error;
    }
  }

  async updateDaybook(daybookId, data) {
    try {
      const daybook = await this.dayBookItemRepository.updateDayBook(
        daybookId,
        data,
      );
      return daybook;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }

  async getItemsByDayBookId(daybookId, actor = null) {
    try {
      await this.assertActorCanAccessDaybook(
        daybookId,
        actor,
        "view items for this daybook",
      );
      return await this.dayBookItemRepository.findByDayBookId(daybookId);
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }

  async getAdditionalChargesByDayBookId(daybookId, actor = null) {
    await this.assertActorCanAccessDaybook(
      daybookId,
      actor,
      "view additional charges for this daybook",
    );
    const repo = new DayBookAdditionalChargeRepository();
    return await repo.findByDaybookId(daybookId);
  }

  async replaceDayBookItems(daybookId, payload, actor = null) {
    return sequelize.transaction(async (t) => {
      await this.assertActorCanAccessDaybook(
        daybookId,
        actor,
        "update items for this daybook",
        t,
      );

      /* -----------------------------------
       1️⃣ Load existing DB items
    ----------------------------------- */
      const existingItems =
        await this.dayBookItemRepository.findByDayBookId(daybookId);

      const existingMap = new Map(existingItems.map((i) => [String(i.id), i]));

      const incomingItems = payload.items || [];

      const toCreate = [];
      const toUpdate = [];
      const incomingIds = new Set();

      /* -----------------------------------
       2️⃣ Split create vs update
    ----------------------------------- */
      for (const item of incomingItems) {
        if (item.id && existingMap.has(String(item.id))) {
          incomingIds.add(String(item.id));
          const existingItem = existingMap.get(String(item.id));
          toUpdate.push({
            ...item,
            sku_unit: normalizeSkuUnit(
              item?.sku_unit ?? existingItem?.sku_unit,
            ),
          });
        } else {
          toCreate.push({
            ...item,
            sku_unit: normalizeSkuUnit(item?.sku_unit),
            daybook_id: daybookId,
          });
        }
      }

      const toDeleteIds = existingItems
        .filter((dbItem) => !incomingIds.has(String(dbItem.id)))
        .map((i) => i.id);

      /* -----------------------------------
       3️⃣ Delete removed items (if any)
    ----------------------------------- */
      if (toDeleteIds.length > 0) {
        await this.dayBookItemSerialRepository.deleteByItemIds(toDeleteIds, t);

        await this.dayBookItemRepository.deleteByIds(toDeleteIds, t);
      }

      /* -----------------------------------
       4️⃣ Update existing items
    ----------------------------------- */
      for (const item of toUpdate) {
        const { id, ...data } = item;

        await this.dayBookItemRepository.updateDayBook(id, data, t);
      }

      /* -----------------------------------
       5️⃣ Create new items
    ----------------------------------- */
      let createdItems = [];
      if (toCreate.length > 0) {
        createdItems = await this.dayBookItemRepository.bulkCreate(toCreate, {
          transaction: t,
        });
      }

      const allItems = [...existingItems, ...createdItems];

      /* -----------------------------------
       6️⃣ UPSERT SERIALS (safe)
    ----------------------------------- */
      for (const uiItem of incomingItems) {
        // const itemId =
        //   uiItem.id ||
        //   createdItems.find((c) => c.item_name === uiItem.item_name)?.id;

        const itemId = uiItem.id;
        if (!itemId) continue;

        // ✅ First remove existing serials for this item
        await this.dayBookItemSerialRepository.deleteByDayBookItem(itemId, t);

        // ✅ Then insert fresh serials
        const serialRows = (uiItem.serials || []).map((s) => ({
          daybook_item_id: itemId,
          serial_number: String(s.serial_number || s).trim(),
          purchased_at: s.purchased_at || uiItem.purchased_at || null,
          warranty_expiry: s.warranty_expiry || uiItem.warranty_expiry || null,
          source: "DAYBOOK",
        }));

        if (serialRows.length > 0) {
          await this.dayBookItemSerialRepository.bulkCreateSerials(
            serialRows,
            t,
          );
        }
      }

      /* -----------------------------------
   7️⃣ Additional Charges (recreate)
----------------------------------- */
      await this.dayBookAdditionalChargeRepository.deleteByDaybook(
        daybookId,
        t,
      );

      if (
        Array.isArray(payload.additionalCharges) &&
        payload.additionalCharges.length > 0
      ) {
        const chargesPayload = payload.additionalCharges.map((c) => {
          const qty = Number(c.quantity) || 0;
          const rate = Number(c.rate) || 0;
          const gstRate = Number(c.gst_rate) || 0;

          const baseAmount = qty * rate;
          const gstAmount = baseAmount * (gstRate / 100);
          const totalAmount = baseAmount + gstAmount;

          return {
            daybook_id: daybookId,
            charge_type: c.charge_type,
            description: c.description || null,
            quantity: qty,
            rate: rate,
            gst_type: c.gst_type,
            gst_rate: gstRate,
            gst_amount: gstAmount.toFixed(2), // ✅ REQUIRED
            total_amount: totalAmount.toFixed(2), // ✅ REQUIRED
          };
        });

        await this.dayBookAdditionalChargeRepository.bulkCreate(
          chargesPayload,
          t,
        );
      }

      /* -----------------------------------
   8️⃣ Reload fresh items from DB
----------------------------------- */
      const finalItems =
        await this.dayBookItemRepository.findByDayBookId(daybookId);

      return finalItems;

      // return true;
    });
  }

  async assertActorCanAccessDaybook(
    daybookId,
    actor = null,
    action = "access this daybook",
    transaction = null,
  ) {
    if (!actor) return null;

    const daybook = await DayBook.findByPk(daybookId, {
      attributes: ["id", "location_scope"],
      transaction,
    });

    if (!daybook) {
      const error = new Error("DayBook not found");
      error.statusCode = 404;
      throw error;
    }

    assertActorCanAccessLocation(actor, daybook.location_scope, action);
    return daybook;
  }
}

module.exports = DayBookItemService;
