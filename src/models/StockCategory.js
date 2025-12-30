// models/StockCategory.js
const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema");

const stockCategorySchema = new mongoose.Schema(
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
    code: { type: String},
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "StockCategory" },
    // stockGroupId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "StockGroup",
    //   required: true
    // },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    auditLogs: [auditLogSchema],
  },
  { timestamps: true }
);
stockCategorySchema.pre("validate", async function (next) {
  try {
    if (this.code) return next();

    const Counter = mongoose.model("Counter");

    const counter = await Counter.findOneAndUpdate(
      {
        clientId: this.clientId || this.client,
        companyId: this.companyId || this.company,
        type: "StockCategory",
      },
      { $inc: { seq: 1 } },
      {
        new: true,
        upsert: true,
      }
    );

    this.code = counter.seq.toString().padStart(6, "0");

    next();
  } catch (error) {
    next(error);
  }
});

stockCategorySchema.index({
  clientId: 1,
  companyId: 1,
  status: 1,
  createdAt: -1,
});

stockCategorySchema.index(
  { companyId: 1, name: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: "delete" } } }
);

stockCategorySchema.index({ name: "text" });

stockCategorySchema.index({ companyId: 1, status: 1 });

stockCategorySchema.index({ clientId: 1 });

stockCategorySchema.index({ status: 1 });

stockCategorySchema.index({ createdBy: 1 });

stockCategorySchema.index({ updatedAt: -1 });
module.exports = mongoose.model("StockCategory", stockCategorySchema);
