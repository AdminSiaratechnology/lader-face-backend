// src/models/Product.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const auditLogSchema = require("../middlewares/auditLogSchema");
const Counter=require("../models/Counter")

// TaxConfiguration sub-schema
const TaxConfigurationSchema = new Schema(
  {
    applicable: { type: Boolean, default: false },
    hsnCode: { type: String },
    taxPercentage: { type: Number },
    cgst: { type: Number },
    sgst: { type: Number },
    cess: { type: Number },
    additionalCess: { type: Number },
    applicableDate: { type: Date },
  },
  { _id: false }
);

const TaxConfigurationHistorySchema = new Schema(
 {
 previous: { type: Object }, // old tax data
 updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
 updatedAt: { type: Date, default: Date.now }
},
{ _id: false }
);

// OpeningQuantity sub-schema
const OpeningQuantitySchema = new Schema(
  {
    godown: { type: Schema.Types.ObjectId, ref: "Godown" },
    batch: { type: String },
    quantity: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

// ProductImage sub-schema
const ProductImageSchema = new Schema(
  {
    angle: { type: String },
    fileUrl: { type: String }, // stored file URL (S3 or local)
    previewUrl: { type: String },
  },
  { _id: false }
);

const ProductSchema = new Schema(
  {
    clientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },

    code: { type: String, required: true, },
    name: { type: String, required: true },
    partNo: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active",
    },

    stockGroup: { type: Schema.Types.ObjectId, ref: "StockGroup" },
    stockCategory: { type: Schema.Types.ObjectId, ref: "StockCategory" },

    batch: { type: Boolean, default: false },

    unit: { type: Schema.Types.ObjectId, ref: "Unit" },
    alternateUnit: { type: Schema.Types.ObjectId, ref: "Unit" },

    minimumQuantity: { type: Number },
    defaultSupplier: { type: String },
    minimumRate: { type: Number },
    maximumRate: { type: Number },
   mfgDate: {
      type: Date, 
    },
    
    expiryDate: {
      type: Date, 
      validate: {
        validator: function (value) {
          // 1. If user didn't provide an Expiry Date, validation passes automatically.
          if (!value) return true;

          // 2. If user provided Expiry, but NO Mfg Date, we can't compare, so we assume it's valid.
          if (!this.mfgDate) return true;

          // 3. If BOTH exist, check if Expiry >= Mfg
          return value >= this.mfgDate;
        },
        message: "Expiry Date cannot be before Manufacturing Date.",
      },
    },

    taxConfigurationHistory: [TaxConfigurationHistorySchema],
    priceIncludesTax: { type: Boolean, default: false },

    defaultGodown: { type: Schema.Types.ObjectId, ref: "Godown" },
    productType: { type: String },

    taxConfiguration: TaxConfigurationSchema,

    openingQuantities: [OpeningQuantitySchema],

    images: [ProductImageSchema],

    remarks: { type: String },

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    auditLogs: [auditLogSchema],
  },
  { timestamps: true }
);
ProductSchema.pre("validate", async function (next) {
  try {
    if (this.code) return next();

    

    const counter = await Counter.findOneAndUpdate(
      {
        clientId: this.clientId,
        companyId: this.companyId,
        type: "Product",
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
ProductSchema.index({
  clientId: 1,
  companyId: 1,
  status: 1,
  createdAt: -1,
});

ProductSchema.index({
  name: "text",
  code: "text",
  partNo: "text",
});

ProductSchema.index({ clientId: 1, companyId: 1, code: 1 });

ProductSchema.index({ stockGroup: 1 });
ProductSchema.index({ stockCategory: 1 });

ProductSchema.index({ status: 1 });

ProductSchema.index({ unit: 1 });
ProductSchema.index({ defaultGodown: 1 });
ProductSchema.index({ createdBy: 1 });

ProductSchema.index({ companyId: 1, name: 1 });
ProductSchema.index({ companyId: 1, code: 1 });
module.exports = mongoose.model("Product", ProductSchema);
