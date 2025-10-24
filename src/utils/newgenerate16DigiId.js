const crypto = require("crypto");

// Generate random 6-digit ID
const generate6DigitId = () =>
  (BigInt("0x" + crypto.randomBytes(4).toString("hex")) % (10n ** 6n)) // 6 digits
    .toString()
    .padStart(6, "0");

module.exports = { generate6DigitId };
