// models/StockGroup.js
const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema");

const stockGroupSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active",
    },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "StockGroup" },
    stockGroupId: {
      type: String,
      required: true,
    },
    auditLogs: [auditLogSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
stockGroupSchema.index({ clientId: 1, companyId: 1, status: 1, createdAt: -1 });

stockGroupSchema.index({ stockGroupId: 1 }, { unique: true });

stockGroupSchema.index({ name: "text", description: "text" });

stockGroupSchema.index({ companyId: 1, status: 1 });

stockGroupSchema.index({ clientId: 1 });
stockGroupSchema.index({ parent: 1 });

stockGroupSchema.index({ status: 1 });

stockGroupSchema.index({ updatedAt: -1 });

stockGroupSchema.index({ createdBy: 1 });
module.exports = mongoose.model("StockGroup", stockGroupSchema);
