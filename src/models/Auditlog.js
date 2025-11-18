const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      required: true,
      enum: [
        "Company",
        "Customer",
        "Agent",
        "Unit",
        "Godown",
        "StockCategory",
        "StockGroup",
        "Vendor",
        "User",
        "Ledger",
        "Product",
        "stockitems",
        "other",
      ],
    },
    action: {
      type: String,
      enum: ["create", "update", "delete", "login", "logout"],
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "module", // ✅ Dynamic Reference
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    details: { type: String },
    changes: { type: Object, default: {} },
    ipAddress: { type: String }, // ✅ Added IP address
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
