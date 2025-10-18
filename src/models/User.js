const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema");
// Permission schema
const permissionSchema = new mongoose.Schema({
  create: { type: Boolean, default: false },
  read: { type: Boolean, default: false },
  update: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
  extra: [{ type: String }],
   changes: { type: Object, default: {} },
}, { _id: false });

// Company Access Schema
const accessSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  modules: {
    type: Map,
    of: {
      type: Map,
      of: permissionSchema,
    },
    default: {},
  },
}, { _id: false });

// 🧠 Audit Log Schema (embedded)


// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },

  role: {
    type: String,
    enum: [
      "SuperAdmin", "Partner", "SubPartner", "Client",
      "Agent", "Salesman", "Customer", "Admin",
    ],
    required: true,
  },

  subRole: {
    type: [String],
    enum: [
      "superadmin_devteam", "superadmin_supportteam", "superadmin_accounts", "superadmin_adminteam",
      "partner_admin", "partner_accounts",
      "subpartner_admin", "subpartner_accounts",
      "salesman", "admin", "customer", "client", "agent",
      "Admin", "InventoryManager", "SalesManager", "PurchaseManager", "HRManager", "FinanceManager", "Customer", "Salesman",
    ],
    default: [],
  },

  parent: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  clientID: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  phone: { type: String },
  area: { type: String },
  pincode: { type: String },
  status: { type: String, enum: ["active", "inactive", "delete"], default: "active" },
  lastLogin: { type: Date, default: Date.now },

  allPermissions: { type: Boolean, default: false },
  access: [accessSchema],

  // 🧾 Maintain full change history here
  auditLogs: [auditLogSchema],
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
