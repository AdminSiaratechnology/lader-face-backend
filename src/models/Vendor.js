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

// Vendor schema
const VendorSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      // required: true,
    }, // reference to company
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    }, // reference to company
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    vendorType: { type: String },
    code: { type: String, required: true, },
    vendorName: { type: String},
    shortName: { type: String },
    vendorGroup: { type: String },
    industryType: { type: String },
    territory: { type: String },
    procurementPerson: { type: String },
    vendorStatus: { type: String },
    companySize: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active",
    },

    name:{ type: String,required: true },
    type:{ type: String, required: true },
    group:{ type: String },
    category:{ type: String },

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
    source: {
      type: String,
      enum: ["website", "mobile_app", "pos", "api"],
      default: "website",
      index: true,
    },
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
VendorSchema.pre("validate", async function (next) {
  try {
    if (this.code) return next();

    const Counter = mongoose.model("Counter");

    const counter = await Counter.findOneAndUpdate(
      {
        clientId: this.clientId,
        companyId: this.companyId,
        type: "vendor",
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
// ----------------------------
VendorSchema.index({ clientId: 1, company: 1, status: 1, createdAt: -1 });
// 👉 Speeds up getVendorsByCompany() and getVendorsByClient()
//    Queries that filter by clientId, company, and status + sort by createdAt

// ---------------------------------
// 🔹 2. Unique Vendor Code per Client
// ---------------------------------
VendorSchema.index({ clientId: 1, code: 1 });
// 👉 Ensures each vendor code is unique for that client
//    (prevents accidental duplicates across same client)

// ---------------------------------
// 🔹 3. Unique Email per Client (Active/Inactive Only)
// ---------------------------------
VendorSchema.index({ clientId: 1, emailAddress: 1 });
// 👉 Allows duplicate emails only for "delete" vendors
// 👉 Enforces unique active emails for real vendors

// ---------------------------------
// 🔹 4. Search Optimization
// ---------------------------------
VendorSchema.index({
  vendorName: "text",
  emailAddress: "text",
  phoneNumber: "text",
});
// 👉 Enables text search for `search` queries (name/email/phone)
// 👉 Fast lookup if you ever filter/search vendors by doc type

// ---------------------------------
// 🔹 6. Audit & Reference Optimization
// ---------------------------------
VendorSchema.index({ createdBy: 1 });
// 👉 Helps when fetching by created user

VendorSchema.index({ company: 1 });
// 👉 Common filter in vendor-company relationship

// ---------------------------------
// 🔹 7. Status Fast Lookup
// ---------------------------------
VendorSchema.index({ status: 1 });
// 👉 Quick retrieval of vendors by active/inactive/delete state

// ---------------------------------
// 🔹 8. Date-based Analytics or Reports
// ---------------------------------
VendorSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("Vendor", VendorSchema);
