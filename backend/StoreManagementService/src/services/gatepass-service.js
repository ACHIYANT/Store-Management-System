const GatePassRepository = require("../repository/gatepass-repository");

class GatePassService {
  async list(query = {}, actor = null) {
    try {
      const repo = new GatePassRepository();
      return await repo.list({ ...query, viewerActor: actor });
    } catch (error) {
      console.log("Something went wrong at service layer (gatePass.list).");
      throw error;
    }
  }

  async getById(id, actor = null) {
    try {
      const repo = new GatePassRepository();
      return await repo.getById(id, null, actor);
    } catch (error) {
      console.log("Something went wrong at service layer (gatePass.getById).");
      throw error;
    }
  }

  async verifyByCode(code, actor = null) {
    try {
      const repo = new GatePassRepository();
      return await repo.verifyByCode(code, actor);
    } catch (error) {
      console.log(
        "Something went wrong at service layer (gatePass.verifyByCode).",
      );
      throw error;
    }
  }

  async createEWasteOutPass(payload, actor = null) {
    try {
      const repo = new GatePassRepository();
      return await repo.createEWasteOutPass({ ...payload, actor });
    } catch (error) {
      console.log(
        "Something went wrong at service layer (gatePass.createEWasteOutPass).",
      );
      throw error;
    }
  }

  async verifyOut(payload, actor = null) {
    try {
      const repo = new GatePassRepository();
      return await repo.verifyOut({ ...payload, actor });
    } catch (error) {
      console.log("Something went wrong at service layer (gatePass.verifyOut).");
      throw error;
    }
  }

  async verifyIn(payload, actor = null) {
    try {
      const repo = new GatePassRepository();
      return await repo.verifyIn({ ...payload, actor });
    } catch (error) {
      console.log("Something went wrong at service layer (gatePass.verifyIn).");
      throw error;
    }
  }

  async updateSignatories(payload, actor = null) {
    try {
      const repo = new GatePassRepository();
      return await repo.updateSignatories({ ...payload, actor });
    } catch (error) {
      console.log(
        "Something went wrong at service layer (gatePass.updateSignatories).",
      );
      throw error;
    }
  }
}

module.exports = GatePassService;
