const mongoose = require('mongoose');

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

  // Salesman aur Customer ke liye company ka reference
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
