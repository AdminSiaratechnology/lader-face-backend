// models/StockGroup.js
const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema");

const stockGroupSchema = new mongoose.Schema({
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
  name: { type: String, required: true, trim: true },
  description: { type: String },
  status: { type: String, enum: [ "active", "inactive", "delete"], default: "active" },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: "StockGroup" },
  stockGroupId:{
    type:String,
    required:true
  },
    auditLogs: [auditLogSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  
}, { timestamps: true });

module.exports = mongoose.model("StockGroup", stockGroupSchema);
