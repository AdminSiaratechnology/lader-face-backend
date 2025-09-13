// controllers/stockCategoryController.js
const StockCategory = require("../models/StockCategory");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

// Create
exports.createStockCategory = asyncHandler(async (req, res) => {
    // res.status(200).json({ message: "Create Stock Category - Not Implemented" });
  const { clientId, companyId, stockGroupId, name, description } = req.body;
  if (!clientId || !companyId || !stockGroupId || !name) throw new ApiError(400, "Missing fields");

  const category = await StockCategory.create({ clientId, companyId, stockGroupId, name, description });
  res.status(201).json(new ApiResponse(201, category, "Stock Category created successfully"));
});

// Get all (optionally by groupId or companyId)
exports.getStockCategories = asyncHandler(async (req, res) => {
  const { companyId, stockGroupId } = req.query;
  const filter = {};
  if (companyId) filter.companyId = companyId;
  if (stockGroupId) filter.stockGroupId = stockGroupId;

  const categories = await StockCategory.find(filter).populate("stockGroupId", "name");
  res.json(new ApiResponse(200, categories, "Stock Categories fetched"));
});

// Update
exports.updateStockCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await StockCategory.findByIdAndUpdate(id, req.body, { new: true });
  if (!updated) throw new ApiError(404, "Stock Category not found");
  res.json(new ApiResponse(200, updated, "Stock Category updated"));
});

// Delete
exports.deleteStockCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await StockCategory.findByIdAndDelete(id);
  if (!deleted) throw new ApiError(404, "Stock Category not found");
  res.json(new ApiResponse(200, null, "Stock Category deleted"));
});
