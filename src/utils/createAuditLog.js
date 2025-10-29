const AuditLog = require("../models/Auditlog");

const createAuditLog = async ({
  module,
  action,
  performedBy,
  referenceId,
  clientId,
  details,
  changes = {},
  ipAddress,
}) => {
  try {
    await AuditLog.create({
      module,
      action,
      performedBy,
      referenceId,
      clientId,
      details,
      changes,
      ipAddress,
    });
  } catch (err) {
    console.error("⚠️ Failed to create audit log:", err.message);
  }
};

module.exports = { createAuditLog };
