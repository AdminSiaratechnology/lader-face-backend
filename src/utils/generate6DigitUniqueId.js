const crypto = require("crypto");



const generate6DigitId = () =>
  (BigInt("0x" + crypto.randomBytes(8).toString("hex")) % (10n ** 6n))
    .toString()
    .padStart(6, "0");


const generate6DigitUniqueId = async (Model, field) => {
  let id, exists;
  do {
    id = generate6DigitId();
    exists = await Model.exists({ [field]: id });
  } while (exists);
  return id;
};

module.exports = { generate6DigitUniqueId };
