const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema");
const Counter = require("./Counter");

// Bank schema
const BankSchema = new mongoose.Schema({
  accountHolderName: String,
  accountNumber: String,
  ifscCode: String,
  swiftCode: String,
  micrNumber: String,
  bankName: String,
  branch: String,
});

// Registration Document schema
const RegistrationDocumentSchema = new mongoose.Schema({
  type: { type: String, required: true },
  file: { type: String, required: true },
  fileName: { type: String, required: true },
});

// Ledger schema
const LedgerSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      // required: true,
    }, // reference to company
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      // required: true,
    }, // reference to company
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    ledgerType: { type: String},
    ledgerCode: { type: String },
    ledgerName: { type: String  },
    shortName: { type: String },
    ledgerGroup: { type: String },
    industryType: { type: String },
    territory: { type: String },
    ledgerStatus: { type: String },
    companySize: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active",
    },
    name:{ type: String,required: true },
    type:{ type: String},
    group:{ type: String},
    category:{ type: String },  
    code:{ type: String,required: true },

    contactPerson: { type: String },
    designation: { type: String },
    phoneNumber: { type: String },
    mobileNumber: { type: String },
    emailAddress: { type: String, required: true },
    faxNumber: { type: String },

    addressLine1: { type: String },
    addressLine2: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String },
    website: { type: String },
    source: {
      type: String,
      enum: ["website", "mobile_app", "pos", "api"],
      default: "website",
      index: true,
    },
    currency: { type: String },

    taxId: { type: String },
    vatNumber: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    tanNumber: { type: String },
    taxCategory: { type: String },
    taxTemplate: { type: String },
    msmeRegistration: { type: String },
    withholdingTaxCategory: { type: String },
    isTaxExempt: { type: Boolean, default: false },
    reverseCharge: { type: Boolean, default: false },
    isFrozenAccount: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },

    bankName: { type: String },
    branchName: { type: String },
    accountNumber: { type: String },
    accountHolderName: { type: String },
    ifscCode: { type: String },
    swiftCode: { type: String },

    banks: [BankSchema], // embedded banks

    externalSystemId: { type: String },
    dataSource: { type: String },
    ledgerPriority: { type: String },
    leadSource: { type: String },
    internalNotes: { type: String },

    logo: { type: String, default: null },
    notes: { type: String },

    registrationDocs: [RegistrationDocumentSchema], // embedded documents
    auditLogs: [auditLogSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
LedgerSchema.pre("validate", async function (next) {
  try {
    if (this.code) return next();

    const Counter = mongoose.model("Counter");

    const counter = await Counter.findOneAndUpdate(
      {
        clientId: this.clientId,
        companyId: this.companyId,
        type: "ledger",
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
LedgerSchema.index({ code: 1 });

LedgerSchema.index({ company: 1, clientId: 1, status: 1, createdAt: -1 });

LedgerSchema.index({ clientId: 1, status: 1, createdAt: -1 });

LedgerSchema.index({
  ledgerName: "text",
  emailAddress: "text",
  contactPerson: "text",
  phoneNumber: "text",
  ledgerCode: "text",
});

LedgerSchema.index({ status: 1 });

LedgerSchema.index({ createdAt: -1 });

LedgerSchema.index({ createdBy: 1 });
module.exports = mongoose.model("Ledger", LedgerSchema);
