const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema");

const unitSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // kis client ka unit hai
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    }, // kis company ka unit hai

    name: { type: String, required: true }, // unit name
    type: { type: String, enum: ["simple", "compound"], required: true }, // simple or compound

    // ✅ Simple unit fields
    symbol: { type: String }, // like kg, L, pcs
    decimalPlaces: { type: Number }, // rounding ke liye
    UQC: { type: String },

    // ✅ Compound unit fields
    firstUnit: { type: String }, // like kg
    conversion: { type: Number }, // like 1 kg = 12 pcs => conversion=12
    secondUnit: { type: String }, // like pcs
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    auditLogs: [auditLogSchema],
    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active",
    },
    code: { type: String },
  },
  { timestamps: true }
);
unitSchema.index({ clientId: 1, companyId: 1, status: 1, createdAt: -1 });

unitSchema.index(
  { companyId: 1, name: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: "delete" } } }
);

unitSchema.index({ name: "text", firstUnit: "text", secondUnit: "text" });

unitSchema.index({ clientId: 1 });

unitSchema.index({ companyId: 1 });

unitSchema.index({ status: 1 });

unitSchema.index({ createdBy: 1 });

unitSchema.index({ updatedAt: -1 });
module.exports = mongoose.model("Unit", unitSchema);
