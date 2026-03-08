const GatePassRepository = require("../repository/gatepass-repository");

class GatePassService {
  async list(query = {}) {
    try {
      const repo = new GatePassRepository();
      return await repo.list(query);
    } catch (error) {
      console.log("Something went wrong at service layer (gatePass.list).");
      throw error;
    }
  }

  async getById(id) {
    try {
      const repo = new GatePassRepository();
      return await repo.getById(id);
    } catch (error) {
      console.log("Something went wrong at service layer (gatePass.getById).");
      throw error;
    }
  }

  async verifyByCode(code) {
    try {
      const repo = new GatePassRepository();
      return await repo.verifyByCode(code);
    } catch (error) {
      console.log(
        "Something went wrong at service layer (gatePass.verifyByCode).",
      );
      throw error;
    }
  }

  async createEWasteOutPass(payload) {
    try {
      const repo = new GatePassRepository();
      return await repo.createEWasteOutPass(payload);
    } catch (error) {
      console.log(
        "Something went wrong at service layer (gatePass.createEWasteOutPass).",
      );
      throw error;
    }
  }

  async verifyOut(payload) {
    try {
      const repo = new GatePassRepository();
      return await repo.verifyOut(payload);
    } catch (error) {
      console.log("Something went wrong at service layer (gatePass.verifyOut).");
      throw error;
    }
  }

  async verifyIn(payload) {
    try {
      const repo = new GatePassRepository();
      return await repo.verifyIn(payload);
    } catch (error) {
      console.log("Something went wrong at service layer (gatePass.verifyIn).");
      throw error;
    }
  }

  async updateSignatories(payload) {
    try {
      const repo = new GatePassRepository();
      return await repo.updateSignatories(payload);
    } catch (error) {
      console.log(
        "Something went wrong at service layer (gatePass.updateSignatories).",
      );
      throw error;
    }
  }
}

module.exports = GatePassService;
