// StoreManagementService/src/utils/approval-flow.js
const { getActiveStages } = require("./approval-api");

/**
 * approval_level: number of completed active stages
 * next stage = activeStages[approval_level], 0-based
 */
async function computeNextStage(daybook, headers = {}) {
  const stages = await getActiveStages(headers); // [{role_name, stage_order, active}, ...] sorted & filtered
  const done = daybook.approval_level || 0;

  if (done >= stages.length) {
    return { stages, next: null, isFinal: true }; // fully approved
  }
  return { stages, next: stages[done], isFinal: false };
}

function userHasRole(user, roleName) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.includes(roleName);
}

module.exports = { computeNextStage, userHasRole };
