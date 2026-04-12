"use strict";

const MaterialIssueReceiptRepository = require("../repository/material-issue-receipt-repository");

class MaterialIssueReceiptService {
  async list(filters = {}, actor = {}) {
    const repo = new MaterialIssueReceiptRepository();
    return repo.list({ ...filters, viewerActor: actor });
  }

  async getById(mirId, actor = {}) {
    const repo = new MaterialIssueReceiptRepository();
    return repo.getById(mirId, actor);
  }

  async uploadSigned(mirId, fileUrl, actor = {}) {
    const repo = new MaterialIssueReceiptRepository();
    return repo.uploadSigned({ mirId, fileUrl, actor });
  }
}

module.exports = MaterialIssueReceiptService;
