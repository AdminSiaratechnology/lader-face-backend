// models/StockCategory.js
const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema");

const stockCategorySchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true
  },
  // stockGroupId: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "StockGroup",
  //   required: true
  // },
  name: { type: String, required: true, trim: true },
  description: { type: String },
  status: { type: String, enum: ["active", "inactive", "delete"], default: "active" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  auditLogs: [auditLogSchema],
  
}, { timestamps: true });

module.exports = mongoose.model("StockCategory", stockCategorySchema);
