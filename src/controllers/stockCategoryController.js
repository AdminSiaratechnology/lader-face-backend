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
  const agentDetail = await User.findById(agentId, { clientID: 1 });
  if (!agentDetail || !agentDetail.clientID) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  const clientId = agentDetail.clientID;

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

exports.getStockCategories = asyncHandler(async (req, res) => {
  
  const { companyId, stockGroupId, search, status, sortBy, sortOrder, limit = 10, page = 1 } = req.query;

  // filter object
  const filter = { status: { $ne: "Delete" } }; // soft delete filter

  if (companyId) filter.companyId = companyId;
  if (stockGroupId) filter.stockGroupId = stockGroupId;
  if (status && status !== "") filter.status = status;

  if (search && search.trim() !== "") {
    const regex = new RegExp(search, "i"); // case-insensitive
    filter.$or = [
      { name: regex },
      { description: regex }, // agar description field exist karta hai
    ];
  }

  // sorting
  let sort= {};
  if (sortBy) {
    let field = sortBy === "name" ? "name" : "createdAt";
    let order = sortOrder === "desc" ? -1 : 1;
    sort[field] = order;
  } else {
    sort = { createdAt: -1 }; // default latest first
  }

  // pagination
  const perPage = parseInt(limit, 10);
  const currentPage = parseInt(page, 10);
  const skip = (currentPage - 1) * perPage;

  // query with pagination
  const [categories, total] = await Promise.all([
    StockCategory.find(filter)
      .populate("stockGroupId", "name")
      .sort(sort)
      .skip(skip)
      .limit(perPage),
    StockCategory.countDocuments(filter),
  ]);

  res.json(
    new ApiResponse(
      200,
      {
        categories,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      "Stock Categories fetched successfully"
    )
  );
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
