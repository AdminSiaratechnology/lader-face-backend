const mongoose = require('mongoose');

// 🧠 Audit Log Schema (embedded)
const auditLogSchema = new mongoose.Schema({
  action: { type: String, enum: ["create", "update", "delete", "login", "logout"], required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  timestamp: { type: Date, default: Date.now },
  details: { type: String },
  changes: { type: Object, default: {} },
}, { _id: false });
module.exports = auditLogSchema;