const Unit = require('../models/Unit');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

// ✅ Create Unit
exports.createUnit = asyncHandler(async (req, res) => {
    // res.status(200).json({ message: "Create Unit - Not Implemented" });
  const { clientId, companyId, name, type, symbol, decimalPlaces, firstUnit, conversion, secondUnit } = req.body;

  if (!clientId || !companyId || !name || !type) {
    throw new ApiError(400, "clientId, companyId, name and type are required");
  }

  const unit = await Unit.create({
    clientId, companyId, name, type,
    symbol, decimalPlaces,
    firstUnit, conversion, secondUnit
  });

  res.status(201).json(new ApiResponse(201, unit, "Unit created successfully"));
});

// ✅ Update Unit
exports.updateUnit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const unit = await Unit.findByIdAndUpdate(id, updateData, { new: true });
  if (!unit) throw new ApiError(404, "Unit not found");

  res.status(200).json(new ApiResponse(200, unit, "Unit updated successfully"));
});

// ✅ Delete Unit
exports.deleteUnit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const unit = await Unit.findByIdAndDelete(id);

  if (!unit) throw new ApiError(404, "Unit not found");

  res.status(200).json(new ApiResponse(200, null, "Unit deleted successfully"));
});

// ✅ Get Units (by client & company)
exports.getUnits = asyncHandler(async (req, res) => {
  const { clientId, companyId } = req.query;

  const filter = {};
  if (clientId) filter.clientId = clientId;
  if (companyId) filter.companyId = companyId;

  const units = await Unit.find(filter);

  res.status(200).json(new ApiResponse(200, units, "Units fetched successfully"));
});
