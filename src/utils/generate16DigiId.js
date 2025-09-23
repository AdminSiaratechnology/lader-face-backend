const crypto = require("crypto");


const generate16DigitId = () =>
  (BigInt("0x" + crypto.randomBytes(8).toString("hex")) % (10n ** 16n))
    .toString()
    .padStart(16, "0");


const generateUniqueId = async (Model, field) => {
  let id, exists;
  do {
    id = generate16DigitId();
    exists = await Model.exists({ [field]: id });
  } while (exists);
  return id;
};

module.exports = { generateUniqueId };
