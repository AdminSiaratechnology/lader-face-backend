const mongoose = require('mongoose');

// Permissions schema
const permissionSchema = new mongoose.Schema({
  create: { type: Boolean, default: false },
  read: { type: Boolean, default: false },
  update: { type: Boolean, default: false },
  delete: { type: Boolean, default: false }
}, { _id: false });

// Access schema (per company)
const accessSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  modules: [
    {
      module: { type: String, required: true }, // e.g. "BusinessManagement"
      subModule: { type: String },              // e.g. "CustomerRegistration"
      permissions: { type: permissionSchema, default: {} }
    }
  ]
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  role: {
    type: String,
    enum: ['SuperAdmin', 'Partner', 'SubPartner', 'Client', 'Agent', 'Salesman', 'Customer'],
    required: true
  },
  subRole: {
    type: [String],
    enum: [
      'superadmin_devteam', 'superadmin_supportteam', 'superadmin_accounts', 'superadmin_adminteam',
      'partner_admin', 'partner_accounts',
      'subpartner_admin', 'subpartner_accounts',
      'salesman', 'admin', 'customer', 'client', 'agent'
    ]
  },

  // Hierarchy: kis user ke under hai
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Client ke pass sirf ek Agent hoga
  clientAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Salesman aur Customer ke liye company ka reference (optional)
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Company wise access control
  access: [accessSchema]

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
