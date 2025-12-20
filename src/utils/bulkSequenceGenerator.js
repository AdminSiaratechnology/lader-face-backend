const Counter = require("../models/Counter");

exports.generateBulkCodes = async ({
  clientId,
  companyId,
  type,
  count,
  pad = 6,
}) => {
  const counter = await Counter.findOneAndUpdate(
    { clientId, companyId, type },
    { $inc: { seq: count } },
    { new: true, upsert: true }
  );

  const start = counter.seq - count + 1;

  return Array.from({ length: count }, (_, i) =>
    (start + i).toString().padStart(pad, "0")
  );
};
