const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema");

const registrationDocSchema = new mongoose.Schema(
  {
    type: { type: String },
    file: { type: String },
    fileName: { type: String },
  },
  { _id: false }
);

const bankSchema = new mongoose.Schema(
  {
    accountHolderName: String,
    accountNumber: String,
    ifscCode: String,
    swiftCode: String,
    micrNumber: String,
    bankName: String,
    branch: String,
  },
  { _id: false }
);
const brandingImageSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g., 'logo', 'favicon', 'banner', 'hero-image', etc._
    file: { type: String, required: true }, // Path or URL to the branding image_
    fileName: { type: String, required: true },
    description: { type: String }, // Optional description for the branding image_
  },
  { _id: false }
);
const companySchema = new mongoose.Schema(
  {
    namePrint: { type: String, required: true },
    nameStreet: String,
    address1: String,
    address2: String,
    address3: String,
    city: String,
    code: String,
    pincode: String,
    state: String,
    country: String,
    telephone: String,
    mobile: String,
    fax: String,
    email: { type: String, required: true},
    website: String,
    gstNumber: String,
    panNumber: String,
    tanNumber: String,
    vatNumber: String,
    msmeNumber: String,
    udyamNumber: String,
    defaultCurrency: {type:String,default:"INR"},
     defaultCurrencySymbol: {type:String,default:"₹"},
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    maintainGodown: { type: Boolean, default: false },
    maintainBatch: { type: Boolean, default: false },
    closingQuantityOrder: { type: Boolean, default: false },
    negativeOrder: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active",
    },

    banks: [bankSchema],
    logo: { type: String, default: null },
    notes: String,
    registrationDocs: [registrationDocSchema],
    bookStartingDate: { type: Date, default: Date.now },
    financialDate: { type: Date, default: Date.now },
    autoApprove: { type: Boolean, default: false },
    brandingImages: [brandingImageSchema],
    maintainAgent: { type: Boolean, default: true },
    source: {
      type: String,
      enum: ["website", "mobile_app", "pos", "api"],
      default: "website",
      index: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    defaultDecimalPlaces: { type: Number, default: 2 },
    isDeleted: { type: Boolean, default: false },
    auditLogs: [auditLogSchema],
  },
  { timestamps: true }
);
companySchema.pre("validate", async function (next) {
  try {
    if (this.code) return next();

    const Counter = mongoose.model("Counter");

    const counter = await Counter.findOneAndUpdate(
      {
        clientId: this.clientId,
        companyId: this.companyId,
        type: "Company",
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
companySchema.index({ client: 1, status: 1, createdAt: -1 });

companySchema.index(
  { client: 1, namePrint: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: "deleted" } } }
);

companySchema.index({ email: 1 });
companySchema.index({ createdBy: 1 });


module.exports = mongoose.model("Company", companySchema);
