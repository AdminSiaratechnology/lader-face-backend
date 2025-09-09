const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
name: { type: String, required: true },
email: { type: String, required: true, unique: true },
password: { type: String, required: true },
role: { type: String, enum: ['SuperAdmin', 'Partner', 'SubPartner', 'Customer'], required: true },
subRole: {
type: [String],
enum: [
'superadmin_devteam', 'superadmin_supportteam', 'superadmin_accounts', 'superadmin_adminteam',
'partner_admin', 'partner_accounts',
'subpartner_admin', 'subpartner_accounts',
'salesman', 'admin', 'customer'
],
default: undefined
},
company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });


module.exports = mongoose.model('User', userSchema);