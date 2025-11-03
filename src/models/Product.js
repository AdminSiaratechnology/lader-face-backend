// src/models/Product.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const auditLogSchema = require("../middlewares/auditLogSchema");

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

    code: { type: String, required: true, unique: true },
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

ProductSchema.index({ clientId: 1, companyId: 1, code: 1 }, { unique: true });

ProductSchema.index({ stockGroup: 1 });
ProductSchema.index({ stockCategory: 1 });

ProductSchema.index({ status: 1 });

ProductSchema.index({ unit: 1 });
ProductSchema.index({ defaultGodown: 1 });
ProductSchema.index({ createdBy: 1 });

ProductSchema.index({ companyId: 1, name: 1 });
ProductSchema.index({ companyId: 1, code: 1 });
module.exports = mongoose.model("Product", ProductSchema);
