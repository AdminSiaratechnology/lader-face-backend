const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema"); // Ensure this path is correct

// --- Sub-Schemas ---
const BankSchema = new mongoose.Schema({
  accountHolderName: String,
  accountNumber: String,
  ifscCode: String,
  swiftCode: String,
  micrNumber: String,
  bankName: String,
  branch: String,
});

const RegistrationDocumentSchema = new mongoose.Schema({
  type: { type: String, required: true },
  file: { type: String, required: true },
  fileName: { type: String, required: true },
});

// --- Main Schema ---
const CustomerSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    customerType: { type: String, required: true, default: "company" },
    
    // Code is NOT unique globally, only per company (see indexes at bottom)
    code: { type: String },

    customerName: { type: String, required: true },
    shortName: { type: String },
    customerGroup: { type: String },
    industryType: { type: String },
    territory: { type: String },
    salesPerson: { type: String },
    customerStatus: { type: String },
    companySize: { type: String },
    
    // Enum is strictly lowercase
    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active",
    },

    contactPerson: { type: String },
    designation: { type: String },
    phoneNumber: { type: String, default: "" },
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

    banks: [BankSchema],

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

    registrationDocs: [RegistrationDocumentSchema],
    auditLogs: [auditLogSchema], // Ensure this is imported correctly
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// --- Code Generation Hook ---
CustomerSchema.pre("validate", async function (next) {
  try {
    // If code is provided in JSON, skip generation
    if (this.code) return next();

    const Customer = mongoose.models.Customer || mongoose.model("Customer");

    const lastCustomer = await Customer.findOne({
      clientId: this.clientId,
      company: this.company,
      status: { $ne: "delete" },
    })
      .sort({ createdAt: -1 })
      .select("code");

    let newCode = "000000000001";

    if (lastCustomer && lastCustomer.code) {
      const lastNum = parseInt(lastCustomer.code, 10);
      if (!isNaN(lastNum)) {
        const nextNum = (lastNum + 1).toString().padStart(12, "0");
        newCode = nextNum;
      }
    }

    this.code = newCode;
    next();
  } catch (err) {
    console.error("Error generating Customer code:", err);
    next(err);
  }
});

// --- Indexes ---
// Unique Code per Company
CustomerSchema.index({ company: 1, code: 1 }, { unique: true });
// Search Indexes
CustomerSchema.index({ company: 1, clientId: 1, status: 1, createdAt: -1 });
CustomerSchema.index({
  customerName: "text",
  emailAddress: "text",
  contactPerson: "text",
  phoneNumber: "text",
});

module.exports = mongoose.model("Customer", CustomerSchema);