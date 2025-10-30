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

// Vendor schema
const VendorSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true }, // reference to company
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    vendorType: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    vendorName: { type: String, required: true },
    shortName: { type: String },
    vendorGroup: { type: String },
    industryType: { type: String },
    territory: { type: String },
    procurementPerson: { type: String },
    vendorStatus: { type: String },
    companySize: { type: String },
     status: { type: String, enum: ["active", "inactive", "delete"], default: "active" },

    contactPerson: { type: String },
    designation: { type: String },
    phoneNumber: { type: String },
    mobileNumber: { type: String },
    emailAddress: { type: String ,unique:true,required:true},
    faxNumber: { type: String },

    addressLine1: { type: String },
    addressLine2: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String },
    website: { type: String },

    currency: { type: String },
    priceList: { type: String },
    paymentTerms: { type: String },
    creditLimit: { type: String },
    creditDays: { type: String },
    discount: { type: String },
    agent: { type: String },

    isFrozenAccount: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    allowZeroValuation: { type: Boolean, default: false },

    taxId: { type: String },
    vatNumber: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    tanNumber: { type: String },
    taxCategory: { type: String },
    taxTemplate: { type: String },
    withholdingTaxCategory: { type: String },
    msmeRegistration: { type: String },
    isTaxExempt: { type: Boolean, default: false },
    reverseCharge: { type: Boolean, default: false },
    exportVendor: { type: Boolean, default: false },

    bankName: { type: String },
    branchName: { type: String },
    accountNumber: { type: String },
    accountHolderName: { type: String },
    ifscCode: { type: String },
    swiftCode: { type: String },
    preferredPaymentMethod: { type: String },
    acceptedPaymentMethods: [{ type: String }],
    creditCardDetails: { type: String },
    paymentInstructions: { type: String },

    banks: [BankSchema], // embedded banks

    approvalWorkflow: { type: String },
    creditLimitApprover: { type: String },
    documentRequired: { type: String },
    externalSystemId: { type: String },
    crmIntegration: { type: String },
    dataSource: { type: String },
    vendorPriority: { type: String },
    leadSource: { type: String },
    internalNotes: { type: String },

    allowPartialShipments: { type: Boolean, default: false },
    allowBackOrders: { type: Boolean, default: false },
    autoInvoice: { type: Boolean, default: false },

    logo: { type: String, default: null },
    notes: { type: String },

    registrationDocs: [RegistrationDocumentSchema], // embedded documents
    auditLogs: [auditLogSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Vendor", VendorSchema);