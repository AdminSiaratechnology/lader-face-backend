const mongoose = require('mongoose');
const auditLogSchema = require('../middlewares/auditLogSchema');

const registrationDocSchema = new mongoose.Schema({
  type: { type: String },
  file: { type: String },
  fileName: { type: String}
}, { _id: false });

const bankSchema = new mongoose.Schema({
  
   accountHolderName: String,
  accountNumber: String,
  ifscCode: String,
  swiftCode: String,
  micrNumber: String,
  bankName: String,
  branch: String,

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
  email: { type: String , required: true , unique: true },
  website: String,
  gstNumber: String,
  panNumber: String,
  tanNumber: String,
  vatNumber:String,
  msmeNumber: String,
  udyamNumber: String,
  defaultCurrency: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  maintainGodown: { type: Boolean, default: false },
  maintainBatch: { type: Boolean, default: false },
  closingQuantityOrder: { type: Boolean, default: false },
  negativeOrder: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active"
    },

  banks: [bankSchema],
  logo: { type: String, default: null },
  notes: String,
  registrationDocs: [registrationDocSchema],
    bookStartingDate: { type: Date, default: Date.now },
  financialDate: { type: Date, default: Date.now },
 

  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isDeleted: { type: Boolean, default: false },
 auditLogs: [auditLogSchema],
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema); 
