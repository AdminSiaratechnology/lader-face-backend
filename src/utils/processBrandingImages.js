// Utility function to process branding images_
const ApiError = require("../utils/apiError");
const processBrandingImages = (files, rawTypes) => {
  if (!files || files?.length === 0) {
    return [];
  }

  let types;
  try {
    types = rawTypes || [];
  } catch (error) {
    throw new ApiError(400, "Invalid branding image types JSON");
  }

  if (types.length !== files.length) {
    throw new ApiError(
      400,
      "Number of branding image files must match the number of types provided"
    );
  }
  return Promise.all(
    files.map((file, index) => ({
      type: types[index] || "Other",
      file: file.location,
      fileName: file.originalname,
      description: "",
    }))
  );
};

module.exports = processBrandingImages;
