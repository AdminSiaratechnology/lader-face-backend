const ApiError=require("../utils/apiError");

const checkUnique = async ({
  model,
  filter,
  message = "Resource already exists",
  excludeId,
}) => {
  const query = { ...filter };

 
  if (query.name) {
    query.name = {
      $regex: `^${query.name}$`,
      $options: "i",
    };
  }

  // ✏️ Update case support
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const isExist = await model.findOne(query).lean();

  if (isExist) {
    throw new ApiError(409, message);
  }
};

module.exports = {checkUnique};