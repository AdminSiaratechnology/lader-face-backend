const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema");

// Bank schema
const BankSchema = new mongoose.Schema({
  accountHolderName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  ifscCode: { type: String, required: true },
  swiftCode: { type: String },
  micrNumber: { type: String },
  bankName: { type: String, required: true },
  branch: { type: String, required: true },
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
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true }, // reference to company
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    ledgerType: { type: String, required: true },
    ledgerCode: { type: String, required: true, unique: true },
    ledgerName: { type: String, required: true },
    shortName: { type: String },
    ledgerGroup: { type: String },
    industryType: { type: String },
    territory: { type: String },
    ledgerStatus: { type: String },
    companySize: { type: String },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Delete"],
      default: "Active"
    },

    contactPerson: { type: String },
    designation: { type: String },
    phoneNumber: { type: String },
    mobileNumber: { type: String },
    emailAddress: { type: String },
    faxNumber: { type: String },

    addressLine1: { type: String },
    addressLine2: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String },
    website: { type: String },

    currency: { type: String },

    taxId: { type: String },
    vatNumber: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    tanNumber: { type: String },
    taxCategory: { type: String },
    taxTemplate: { type: String },
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

module.exports = mongoose.model("Ledger", LedgerSchema);