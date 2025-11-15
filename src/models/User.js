const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema");
const { init } = require("./Auditlog");
// Permission schema
// Permission schema
const permissionSchema = new mongoose.Schema(
  {
    create: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    update: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    extra: [{ type: String }],
    changes: { type: Object, default: {} },
  },
  { _id: false }
);

// Company Access Schema - FIXED: Using Mixed type instead of Map
const accessSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    modules: {
      type: mongoose.Schema.Types.Mixed, // ✅ Changed from Map to Mixed
      default: {},
    },
  },
  { _id: false }
);
const limitHistorySchema = new mongoose.Schema(
  {
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 
    requestedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // NEW FIELD
    requestedLimit: { type: Number },
    initialLimit: { type: Number },
    previousLimit: { type: Number, default: 0 },
    newLimit: { type: Number },
    approvedLimit: { type: Number },
    action: {
      type: String,
      enum: ["assigned", "requested", "approved"],
      required: true,
    },
    reason: { type: String, default: "" },
    remarks: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
    documents: [{ type: String }],
  },
  { _id: false }
);

// 🧠 Audit Log Schema (embedded)

// User Schema
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },

    role: {
      type: String,
      enum: [
        "SuperAdmin",
        "Partner",
        "SubPartner",
        "Client",
        "Agent",
        "Salesman",
        "Customer",
        "Admin",
      ],
      required: true,
    },

    subRole: {
      type: [String],
      enum: [
        "superadmin_devteam",
        "superadmin_supportteam",
        "superadmin_accounts",
        "superadmin_adminteam",
        "partner_admin",
        "partner_accounts",
        "subpartner_admin",
        "subpartner_accounts",
        "salesman",
        "admin",
        "customer",
        "client",
        "agent",
        "Admin",
        "InventoryManager",
        "SalesManager",
        "PurchaseManager",
        "HRManager",
        "FinanceManager",
        "Customer",
        "Salesman",
      ],
      default: [],
    },

    parent: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    clientID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    country: { type: String },
    state: { type: String },
    city: { type: String },
    region: { type: String },
    phone: { type: String },
    area: { type: String },
    pincode: { type: String },
    status: {
      type: String,
      enum: ["active", "inactive", "delete", "suspended", "hold"],
      default: "active",
    },
    lastLogin: { type: Date },
    loginHistory: [{ type: Date }],
    limitHistory: [limitHistorySchema],
    allPermissions: { type: Boolean, default: false },
    access: [accessSchema],

    // 🧾 Maintain full change history here
    auditLogs: [auditLogSchema],
    profilePicture: { type: String, default: "" },
    documents: [{ type: String }],
    limit: { type: Number },
    partnerType: { type: String, enum: ["silver", "gold", "diamond"] },
    contactPerson: { type: String },
    code: { type: String },
    multiplePhones: [{ type: String }],
  },
  { timestamps: true }
);
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ clientID: 1 });
userSchema.index({ clientID: 1, name: 1 });
userSchema.index({ clientID: 1, createdAt: -1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ "access.company": 1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ name: "text", email: "text" });

userSchema.index({ clientID: 1 });
userSchema.index({ status: 1 });
module.exports = mongoose.model("User", userSchema);
