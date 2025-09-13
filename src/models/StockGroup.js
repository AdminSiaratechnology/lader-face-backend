// models/StockGroup.js
const mongoose = require("mongoose");

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
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
}, { timestamps: true });

module.exports = mongoose.model("StockGroup", stockGroupSchema);
