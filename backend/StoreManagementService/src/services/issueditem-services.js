// services/issueditem-service.js
const IssuedItemRepository = require("../repository/issueditem-repository");

class IssuedItemService {
  // Non-serialized issuance: { stockId, employeeId, quantity }
  async issueItem(payload, actor = null) {
    try {
      const repo = new IssuedItemRepository();
      return await repo.issueItem({ ...payload, actor });
    } catch (error) {
      console.log("Something went wrong at service layer (issueItem).");
      throw { error };
    }
  }

  // ? Instead of the above function listAll() below i am creating the function search()

  async search(filters, actor = null) {
    try {
      const repo = new IssuedItemRepository();
      return await repo.search({ ...filters, viewerActor: actor });
    } catch (error) {
      console.log("Something went wrong at service layer (issueSerialized).");
      throw { error };
    }
  }

  // Serialized issuance: { stockId, employeeId, assetIds: [] }
  async issueSerialized(payload, actor = null) {
    try {
      const repo = new IssuedItemRepository();
      return await repo.issueSerialized({ ...payload, actor });
    } catch (error) {
      console.log("Something went wrong at service layer (issueSerialized).");
      throw { error };
    }
  }

  // NEW: orchestrates a single bulk transaction via repository
  async issueMany({
    employeeId,
    custodianId,
    custodianType,
    items = [],
    serializedItems = [],
    notes = null,
    requisitionUrl = null,
    requisitionId = null,
    actor = null,
  }) {
    const repo = new IssuedItemRepository();
    return await repo.issueMany({
      employeeId,
      custodianId,
      custodianType,
      items,
      serializedItems,
      notes,
      requisitionUrl,
      requisitionId,
      actor,
    });
  }
}

module.exports = IssuedItemService;
