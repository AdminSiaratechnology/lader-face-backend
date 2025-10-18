const mongoose = require('mongoose');
const auditLogSchema = require("../middlewares/auditLogSchema");

const unitSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // kis client ka unit hai
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }, // kis company ka unit hai

  name: { type: String, required: true }, // unit name
  type: { type: String, enum: ['simple', 'compound'], required: true }, // simple or compound

  // ✅ Simple unit fields
  symbol: { type: String },          // like kg, L, pcs
  decimalPlaces: { type: Number },   // rounding ke liye
  UQC:{type:String,required:true},

  // ✅ Compound unit fields
  firstUnit: { type: String },       // like kg
  conversion: { type: Number },      // like 1 kg = 12 pcs => conversion=12
  secondUnit: { type: String },      // like pcs
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  auditLogs: [auditLogSchema],
  status: { type: String, enum: ['Active', 'Inactive', "Deleted"], default: 'Active' },
}, { timestamps: true });

module.exports = mongoose.model('Unit', unitSchema);
