const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema");

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

// Customer schema
const CustomerSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    }, // reference to company
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    customerType: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    shortName: { type: String },
    customerGroup: { type: String },
    industryType: { type: String },
    territory: { type: String },
    salesPerson: { type: String },
    customerStatus: { type: String },
    companySize: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active",
    },

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

    currency: { type: String },
    priceList: { type: String },
    paymentTerms: { type: String },
    creditLimit: { type: String },
    creditDays: { type: String },
    discount: { type: String },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: "Agent" },

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
    exportCustomer: { type: Boolean, default: false },

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
    customerPriority: { type: String },
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
CustomerSchema.index({ code: 1 }, { unique: true });
CustomerSchema.index({ emailAddress: 1 });

CustomerSchema.index({ company: 1, clientId: 1, status: 1, createdAt: -1 });
CustomerSchema.index({ clientId: 1, status: 1, createdAt: -1 });

CustomerSchema.index({
  customerName: "text",
  emailAddress: "text",
  contactPerson: "text",
  phoneNumber: "text",
});

CustomerSchema.index({ status: 1 });

CustomerSchema.index({ createdAt: -1 });
module.exports = mongoose.model("Customer", CustomerSchema);
