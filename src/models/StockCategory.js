// models/StockCategory.js
const mongoose = require("mongoose");

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
  stockGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StockGroup",
    required: true
  },
  name: { type: String, required: true, trim: true },
  description: { type: String },
  status: { type: String, enum: ["Active", "Inactive","Delete"], default: "Active" },
}, { timestamps: true });

module.exports = mongoose.model("StockCategory", stockCategorySchema);
