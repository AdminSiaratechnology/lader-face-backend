// controllers/stockGroupController.js
const crypto = require("crypto");
const StockGroup = require("../models/StockGroup");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const { default: mongoose } = require("mongoose");
const {generateUniqueId} =require("../utils/generate16DigiId")



const buildFilter = (query) => {
  const filter = {};
  if (query.companyId) filter.companyId = query.companyId;
  return filter;
};

const ensureFound = (doc, message = "Resource not found") => {
  if (!doc) throw new ApiError(404, message);
  return doc;
};

// ===== Controllers ===== //

// Create
exports.createStockGroup = asyncHandler(async (req, res) => {
  const agentId = req.user.id;
  const { companyId, name, description } = req.body;

  // Required field check
  if (!companyId || !name) {
    throw new ApiError(400, "Company ID and name are required");
  }

  // Sirf clientAgent field hi le aayenge
  const agentDetail = await User.findById(agentId, { clientAgent: 1 });

  if (!agentDetail || !agentDetail.clientAgent) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  const clientId = agentDetail.clientAgent;

  // Generate unique stockGroupId
  const stockGroupId = await generateUniqueId(StockGroup,"stockGroupId");

  // Create stock group
  const stockGroup = await StockGroup.create({
    clientId,
    companyId,
    stockGroupId,
    name,
    description,
  });

  res
    .status(201)
    .json(new ApiResponse(201, stockGroup, "Stock Group created successfully"));
});

// Get all
exports.getStockGroups = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "stockgroups",        // collection name
        localField: "clientAgent",  // user ka field
        foreignField: "clientId",   // stockgroup ka field
        as: "stockGroups",
        pipeline: [
          {
            $match: {
              status: { $ne: "Delete" } // sirf non-deleted groups
            }
          }
        ]
      },
    },
    {
      $project: {
        stockGroups: 1,
        _id: 0,
      },
    },
  ], { maxTimeMS: 60000, allowDiskUse: true });

  const stockGroups = result.length > 0 ? result[0].stockGroups : [];

  res.json(new ApiResponse(200, stockGroups, "Stock Groups fetched"));
});


// Update
exports.updateStockGroup = asyncHandler(async (req, res) => {
    const agentId = req.user.id;
  const { companyId, name, description } = req.body;

  // Required field check
  if (!companyId || !name) {
    throw new ApiError(400, "Company ID and name are required");
  }

  // Sirf clientAgent field hi le aayenge
  const agentDetail = await User.findById(agentId, { clientAgent: 1 });

  if (!agentDetail || !agentDetail.clientAgent) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }
  const updated = ensureFound(
    await StockGroup.findByIdAndUpdate(req.params.id, req.body, { new: true }),
    "Stock Group not found"
  );
  res.json(new ApiResponse(200, updated, "Stock Group updated"));
});

// Delete
exports.deleteStockGroup = asyncHandler(async (req, res) => {
  const agentId = req.user.id;
  const { id } = req.params;

  // Sirf clientAgent field hi le aayenge
  const agentDetail = await User.findById(agentId, { clientAgent: 1 });

  if (!agentDetail || !agentDetail.clientAgent) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  // Stock group exist check
  const stock = await StockGroup.findById(id);
  if (!stock) {
    throw new ApiError(404, "Stock Group not found");
  }

  // Soft delete update
  stock.status = "Delete";
  await stock.save();

  res.json(new ApiResponse(200, stock, "Stock Group deleted successfully"));
});

