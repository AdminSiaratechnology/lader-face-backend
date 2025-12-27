const findOrCreateByName = async (
  Model,
  name,
  companyId,
  userId,
  clientId
) => {
  if (!name || !name.trim()) return null;

  const trimmed = name.trim();

  // 🔍 Find existing (case-insensitive)
  let doc = await Model.findOne({
    name: { $regex: new RegExp("^" + trimmed + "$", "i") },
    companyId,
  });

  // ➕ Create if not exists
  if (!doc) {
    const payload = {
      name: trimmed,
      clientId,
      companyId,
      createdBy: userId,
      status: "active",
    };

    // ⭐ Special handling for Unit model
    if (Model.modelName === "Unit") {
      payload.type = "simple";     // required by Unit schema
      payload.symbol = trimmed;    // symbol = unit name for now
    }

    doc = await Model.create(payload);
  }

  return doc;
};
module.exports ={findOrCreateByName}