// controllers/stockCategoryController.js
const crypto = require("crypto");
const StockCategory = require("../models/StockCategory");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const { default: mongoose } = require("mongoose");

// ===== Helpers ===== //
const ensureFound = (doc, message = "Resource not found") => {
  if (!doc) throw new ApiError(404, message);
  return doc;
};


exports.createStockCategory = asyncHandler(async (req, res) => {
  const { companyId, stockGroupId, name, description } = req.body;
  const agentId = req.user.id;

  // Required fields
  if (!companyId || !stockGroupId || !name) {
    throw new ApiError(400, "Company ID, Stock Group ID and Name are required");
  }

  // Logged-in user check
  const agentDetail = await User.findById(agentId, { clientAgent: 1 });
  if (!agentDetail || !agentDetail.clientAgent) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  const clientId = agentDetail.clientAgent;

  // Create category
  const category = await StockCategory.create({
    clientId,
    companyId,
    stockGroupId,
    name,
    description,
    status: "Active",
  });

  res.status(201).json(new ApiResponse(201, category, "Stock Category created successfully"));
});

// Get all categories (optional filter by companyId or stockGroupId)
exports.getStockCategories = asyncHandler(async (req, res) => {
  const { companyId, stockGroupId } = req.query;
  const filter = { status: { $ne: "Delete" } }; // soft delete filter

  if (companyId) filter.companyId = companyId;
  if (stockGroupId) filter.stockGroupId = stockGroupId;

  const categories = await StockCategory.find(filter).populate("stockGroupId", "name");
  res.json(new ApiResponse(200, categories, "Stock Categories fetched"));
});

// Update Stock Category
exports.updateStockCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await StockCategory.findByIdAndUpdate(id, req.body, { new: true });
  ensureFound(updated, "Stock Category not found");
  res.json(new ApiResponse(200, updated, "Stock Category updated"));
});

// Delete Stock Category (Soft delete → status: "Delete")
exports.deleteStockCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await StockCategory.findById(id);
  ensureFound(category, "Stock Category not found");

  category.status = "Delete";
  await category.save();

  res.json(new ApiResponse(200, category, "Stock Category deleted successfully"));
});
