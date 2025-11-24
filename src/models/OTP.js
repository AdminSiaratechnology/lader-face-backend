const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
email: { type: String, required: true },
otp: { type: String, required: true },
expiresAt: {
type: Date,
required: true,
index: { expires: 0 }
},
attempts: { type: Number, default: 1 }, // 🔥 count OTP requests_
firstRequestAt: { type: Date, default: Date.now }, // 🔥 time window start_
isVerified: { type: Boolean, default: false }
});

module.exports = mongoose.model("OTP", otpSchema);