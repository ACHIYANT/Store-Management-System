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

  async getByAssetId(assetId, actor = null) {
    try {
      const repo = new AssetEventRepository();
      return await repo.getByAssetId(assetId, actor);
    } catch (error) {
      console.log("Something went wrong at service layer (getByAssetId).");
      throw { error };
    }
  }

  async getTimeline(assetId, actor = null) {
    try {
      const repo = new AssetEventRepository();
      return await repo.getTimeline(assetId, actor);
    } catch (error) {
      console.log("Something went wrong at service layer (getTimeline).");
      throw { error };
    }
  }

  async getByDayBookId(daybookId, actor = null) {
    try {
      const repo = new AssetEventRepository();
      return await repo.getByDayBookId(daybookId, actor);
    } catch (error) {
      console.log("Something went wrong at service layer (getByDayBookId).");
      throw { error };
    }
  }

  async getByIssuedItemId(issuedItemId, actor = null) {
    try {
      const repo = new AssetEventRepository();
      return await repo.getByIssuedItemId(issuedItemId, actor);
    } catch (error) {
      console.log("Something went wrong at service layer (getByIssuedItemId).");
      throw { error };
    }
  }

  async getByEmployeeHistory(employeeId, actor = null) {
    try {
      const repo = new AssetEventRepository();
      return await repo.getByEmployeeHistory(employeeId, actor);
    } catch (error) {
      console.log(
        "Something went wrong at service layer (getByEmployeeHistory).",
      );
      throw { error };
    }
  }

  async recent(limit, actor = null) {
    try {
      const repo = new AssetEventRepository();
      return await repo.recent(limit, actor);
    } catch (error) {
      console.log("Something went wrong at service layer (recent).");
      throw { error };
    }
  }

  async search(filters, actor = null) {
    try {
      const repo = new AssetEventRepository();
      return await repo.search({ ...filters, viewerActor: actor });
    } catch (error) {
      console.log("Something went wrong at service layer (search).");
      throw { error };
    }
  }
}

module.exports = AssetEventService;
