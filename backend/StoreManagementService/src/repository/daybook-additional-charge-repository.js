const { DayBookAdditionalCharge } = require("../models");

class DayBookAdditionalChargeRepository {
  async bulkCreate(charges, transaction) {
    return DayBookAdditionalCharge.bulkCreate(charges, { transaction });
  }

  async findByDaybookId(daybook_id) {
    return DayBookAdditionalCharge.findAll({ where: { daybook_id } });
  }
  
  async deleteByDaybook(daybookId, transaction) {
    return DayBookAdditionalCharge.destroy({
      where: { daybook_id: daybookId },
      transaction,
    });
  }
}

module.exports = DayBookAdditionalChargeRepository;
