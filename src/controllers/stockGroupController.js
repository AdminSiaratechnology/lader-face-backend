// controllers/stockGroupController.js
const StockGroup = require("../models/StockGroup");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

// Create
exports.createStockGroup = asyncHandler(async (req, res) => {
    // res.status(200).json({ message: "Create Stock Group - Not Implemented" });
  const { clientId, companyId, name, description } = req.body;
  if (!clientId || !companyId || !name) throw new ApiError(400, "Missing fields");

  const stockGroup = await StockGroup.create({ clientId, companyId, name, description });
  res.status(201).json(new ApiResponse(201, stockGroup, "Stock Group created successfully"));
});

// Get all
exports.getStockGroups = asyncHandler(async (req, res) => {
  const { companyId } = req.query;
  const groups = await StockGroup.find(companyId ? { companyId } : {});
  res.json(new ApiResponse(200, groups, "Stock Groups fetched"));
});

// Update
exports.updateStockGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await StockGroup.findByIdAndUpdate(id, req.body, { new: true });
  if (!updated) throw new ApiError(404, "Stock Group not found");
  res.json(new ApiResponse(200, updated, "Stock Group updated"));
});

// Delete
exports.deleteStockGroup = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await StockGroup.findByIdAndDelete(id);
  if (!deleted) throw new ApiError(404, "Stock Group not found");
  res.json(new ApiResponse(200, null, "Stock Group deleted"));
});
