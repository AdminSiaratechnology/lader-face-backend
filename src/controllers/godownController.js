const Godown = require("../models/Godown");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const ApiError = require("../utils/apiError");

// ✅ Create Godown
exports.createGodown = asyncHandler(async (req, res) => {
  const { company, client, code, name, ...rest } = req.body;

  if (!company || !client || !code || !name) {
    throw new ApiError(400, "Company, Client, Code and Name are required");
  }

  const godown = await Godown.create({
    company,
    client,
    code,
    name,
    ...rest,
  });

  res
    .status(201)
    .json(new ApiResponse(201, godown, "Godown created successfully"));
});

// ✅ Get all godowns
exports.getGodowns = asyncHandler(async (req, res) => {
  const godowns = await Godown.find()
    .populate("company", "namePrint email")
    .populate("client", "name email");

  res.status(200).json(new ApiResponse(200, godowns, "Godowns fetched"));
});

// ✅ Get godown by ID
exports.getGodownById = asyncHandler(async (req, res) => {
  const godown = await Godown.findById(req.params.id)
    .populate("company", "namePrint")
    .populate("client", "name email");

  if (!godown) throw new ApiError(404, "Godown not found");

  res.status(200).json(new ApiResponse(200, godown, "Godown fetched"));
});

// ✅ Get godowns by Company
exports.getGodownsByCompany = asyncHandler(async (req, res) => {
  const { companyId } = req.params;

  const godowns = await Godown.find({ company: companyId }).populate(
    "company",
    "namePrint"
  );

  res.status(200).json(new ApiResponse(200, godowns, "Godowns fetched"));
});

// ✅ Update godown
exports.updateGodown = asyncHandler(async (req, res) => {
  const godown = await Godown.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });

  if (!godown) throw new ApiError(404, "Godown not found");

  res.status(200).json(new ApiResponse(200, godown, "Godown updated"));
});

// ✅ Delete godown
exports.deleteGodown = asyncHandler(async (req, res) => {
  const godown = await Godown.findByIdAndDelete(req.params.id);

  if (!godown) throw new ApiError(404, "Godown not found");

  res.status(200).json(new ApiResponse(200, {}, "Godown deleted"));
});
