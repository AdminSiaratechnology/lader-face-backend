const mongoose = require('mongoose');

const registrationDocSchema = new mongoose.Schema({
  type: { type: String, required: true },
  file: { type: String, required: true },
  fileName: { type: String, required: true }
}, { _id: false });

const bankSchema = new mongoose.Schema({
  name: String,
  accountNumber: String,
  ifsc: String,
  branch: String
}, { _id: false });

const companySchema = new mongoose.Schema({
  namePrint: { type: String, required: true },
  nameStreet: String,
  address1: String,
  address2: String,
  address3: String,
  city: String,
  code:String,
  pincode: String,
  state: String,
  country: String,
  telephone: String,
  mobile: String,
  fax: String,
  email: String,
  website: String,
  gstNumber: String,
  panNumber: String,
  tanNumber: String,
  msmeNumber: String,
  udyamNumber: String,
  defaultCurrency: String,
  maintainGodown: { type: Boolean, default: false },
  maintainBatch: { type: Boolean, default: false },
  closingQuantityOrder: { type: Boolean, default: false },
  negativeOrder: { type: Boolean, default: false },

  banks: [bankSchema],
  logo: { type: String, default: null },
  notes: String,
  registrationDocs: [registrationDocSchema],

  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
