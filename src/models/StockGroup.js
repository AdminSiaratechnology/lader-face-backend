// models/StockGroup.js
const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema");
const Counter = require("./Counter");

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
    code: { type: String },
    auditLogs: [auditLogSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

stockGroupSchema.pre("validate", async function (next) {
  try {
    if (this.code) return next();

    

    const counter = await Counter.findOneAndUpdate(
      {
        clientId: this.clientId,
        companyId: this.companyId,
        type: "StockGroup",
      },
      { $inc: { seq: 1 } },
      {
        new: true,
        upsert: true,
      }
    );

    this.code = counter.seq.toString().padStart(6, "0");
    this.stockGroupId=counter.seq.toString().padStart(6, "0")

    next();
  } catch (error) {
    next(error);
  }
});
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
