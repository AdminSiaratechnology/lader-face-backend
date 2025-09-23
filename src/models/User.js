const mongoose = require('mongoose');

// Permission schema
const permissionSchema = new mongoose.Schema({
  create: { type: Boolean, default: false },
  read: { type: Boolean, default: false },
  update: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
  extra: [{ type: String }]
}, { _id: false });

// Company Access Schema
const accessSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  modules: {
    type: Map,
    of: {
      type: Map,
      of: permissionSchema
    },
    default: {}
  }
}, { _id: false });

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },

  role: {
    type: String,
    enum: [
      'SuperAdmin', 'Partner', 'SubPartner', 'Client',
      'Agent', 'Salesman', 'Customer', 'Admin'
    ],
    required: true
  },

  subRole: {
    type: [String],
    enum: [
      'superadmin_devteam', 'superadmin_supportteam', 'superadmin_accounts', 'superadmin_adminteam',
      'partner_admin', 'partner_accounts',
      'subpartner_admin', 'subpartner_accounts',
      'salesman', 'admin', 'customer', 'client', 'agent',
      'Admin', 'InventoryManager', 'SalesManager', 'PurchaseManager', 'HRManager', 'FinanceManager'
    ],
    default: []
  },

  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  clientAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // New fields to match your JSON
  phone: { type: String },
  area: { type: String },
  pincode: { type: String },
  status: { type: String, enum: ['active', 'inactive',"delete"], default: 'active' },
  lastLogin: { type: String,default:new Date() }, // You can later change this to Date if needed

  allPermissions: { type: Boolean, default: false },
  access: [accessSchema]

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
