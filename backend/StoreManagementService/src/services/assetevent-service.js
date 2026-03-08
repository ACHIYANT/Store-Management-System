// services/assetevent-service.js
const AssetEventRepository = require("../repository/assetevent-repository");

class AssetEventService {
  async create(data, options = {}) {
    try {
      const repo = new AssetEventRepository();
      return await repo.create(data, options);
    } catch (error) {
      console.log("Something went wrong at service layer (AssetEvent.create).");
      throw { error };
    }
  }

  async bulkCreate(events) {
    try {
      const repo = new AssetEventRepository();
      return await repo.bulkCreate(events);
    } catch (error) {
      console.log(
        "Something went wrong at service layer (AssetEvent.bulkCreate).",
      );
      throw { error };
    }
  }

  async getByAssetId(assetId) {
    try {
      const repo = new AssetEventRepository();
      return await repo.getByAssetId(assetId);
    } catch (error) {
      console.log("Something went wrong at service layer (getByAssetId).");
      throw { error };
    }
  }

  async getTimeline(assetId) {
    try {
      const repo = new AssetEventRepository();
      return await repo.getTimeline(assetId);
    } catch (error) {
      console.log("Something went wrong at service layer (getTimeline).");
      throw { error };
    }
  }

  async getByDayBookId(daybookId) {
    try {
      const repo = new AssetEventRepository();
      return await repo.getByDayBookId(daybookId);
    } catch (error) {
      console.log("Something went wrong at service layer (getByDayBookId).");
      throw { error };
    }
  }

  async getByIssuedItemId(issuedItemId) {
    try {
      const repo = new AssetEventRepository();
      return await repo.getByIssuedItemId(issuedItemId);
    } catch (error) {
      console.log("Something went wrong at service layer (getByIssuedItemId).");
      throw { error };
    }
  }

  async getByEmployeeHistory(employeeId) {
    try {
      const repo = new AssetEventRepository();
      return await repo.getByEmployeeHistory(employeeId);
    } catch (error) {
      console.log(
        "Something went wrong at service layer (getByEmployeeHistory).",
      );
      throw { error };
    }
  }

  async recent(limit) {
    try {
      const repo = new AssetEventRepository();
      return await repo.recent(limit);
    } catch (error) {
      console.log("Something went wrong at service layer (recent).");
      throw { error };
    }
  }

  async search(filters) {
    try {
      const repo = new AssetEventRepository();
      return await repo.search(filters);
    } catch (error) {
      console.log("Something went wrong at service layer (search).");
      throw { error };
    }
  }
}

module.exports = AssetEventService;
