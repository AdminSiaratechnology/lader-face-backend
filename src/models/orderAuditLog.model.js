const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    action: { type: String, required: true }, // e.g., 'created', 'status_updated', 'details_updated'_
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    oldData: { type: String }, // JSON.stringify(oldOrder)_
    newData: { type: String }, // JSON.stringify(newOrder)_
    changes: { type: Object }, // Optional: { field: { old: val, new: val } }_
  },
  { timestamps: true }
);

module.exports = mongoose.model("OrderAuditLog", auditLogSchema);
