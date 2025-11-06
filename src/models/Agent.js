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

// Agent schema
const AgentSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true }, // reference to company
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    agentType: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    agentName: { type: String, required: true },
    shortName: { type: String },
    agentCategory: { type: String },
    specialty: { type: String },
    territory: { type: String },
    supervisor: { type: String },
    agentStatus: { type: String },
    experienceLevel: { type: String },
     status: { type: String, enum: [ "active", "inactive", "delete"], default: "active" },


    contactPerson: { type: String },
    designation: { type: String },
    phoneNumber: { type: String },
    mobileNumber: { type: String },
    emailAddress: { type: String ,required:true},
    faxNumber: { type: String },

    addressLine1: { type: String },
    addressLine2: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    country: { type: String },
    website: { type: String },

    currency: { type: String },
    commissionStructure: { type: String },
    paymentTerms: { type: String },
    commissionRate: { type: String },

    taxId: { type: String },
    vatNumber: { type: String },
    gstNumber: { type: String },
    panNumber: { type: String },
    tanNumber: { type: String },
    taxCategory: { type: String },
    taxTemplate: { type: String },
    msmeRegistration: {type: String },
    withholdingTaxCategory: { type: String },
    isTaxExempt: { type: Boolean, default: false },
    reverseCharge: { type: Boolean, default: false },

    bankName: { type: String },
    branchName: { type: String },
    accountNumber: { type: String },
    accountHolderName: { type: String },
    ifscCode: { type: String },
    swiftCode: { type: String },
    preferredPaymentMethod: { type: String },
    acceptedPaymentMethods: [{ type: String }],
    paymentInstructions: { type: String },

    banks: [BankSchema], // embedded banks

    approvalWorkflow: { type: String },
    documentRequired: { type: String },
    externalSystemId: { type: String },
    crmIntegration: { type: String },
    dataSource: { type: String },
    agentPriority: { type: String },
    leadSource: { type: String },
    internalNotes: { type: String },

    logo: { type: String, default: null },
    notes: { type: String },

    registrationDocs: [RegistrationDocumentSchema], // embedded documents
    auditLogs: [auditLogSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    performanceRating: { type: Number, default: 0 },
    activeContracts: { type: Number, default: 0 }
  },
  { timestamps: true }
);
AgentSchema.index({ code: 1 }, { unique: true });

AgentSchema.index({ company: 1, clientId: 1, status: 1, createdAt: -1 });

AgentSchema.index({ clientId: 1, status: 1, createdAt: -1 });

AgentSchema.index({
  agentName: "text",
  emailAddress: "text",
  contactPerson: "text",
  phoneNumber: "text",
  code: "text",
});

AgentSchema.index({ status: 1 });

AgentSchema.index({ createdAt: -1 });

AgentSchema.index({ createdBy: 1 });
module.exports = mongoose.model("Agent", AgentSchema);