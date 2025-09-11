const mongoose = require('mongoose');

const companyUserAccessSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  module: { type: String, required: true }, // e.g. "Orders", "Products", "Stocks"
  permissions: {
    create: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    update: { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
  }
}, { timestamps: true });

module.exports = mongoose.model('CompanyUserAccess', companyUserAccessSchema);
