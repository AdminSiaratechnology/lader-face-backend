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
  const { search, status, sortBy, sortOrder, limit = 10, page = 1 } = req.query;

  const perPage = parseInt(limit, 10);
  const currentPage = parseInt(page, 10);
  const skip = (currentPage - 1) * perPage;

  // aggregation
  const result = await User.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(userId) },
    },
    {
      $lookup: {
        from: "stockgroups",
        localField: "clientAgent",
        foreignField: "clientId",
        as: "stockGroups",
        pipeline: [
          { $match: { status: { $ne: "Delete" } } },
          ...(status && status !== "" ? [{ $match: { status } }] : []),
          ...(search && search.trim() !== ""
            ? [
                {
                  $match: {
                    $or: [
                      { name: { $regex: search, $options: "i" } },
                      { description: { $regex: search, $options: "i" } },
                    ],
                  },
                },
              ]
            : []),
          {
            $sort: (() => {
              let field = sortBy === "name" ? "name" : "createdAt";
              let order = sortOrder === "desc" ? -1 : 1;
              return { [field]: order };
            })(),
          },
        ],
      },
    },
    { $unwind: { path: "$stockGroups", preserveNullAndEmptyArrays: false } },
    { $replaceRoot: { newRoot: "$stockGroups" } },
    {
      $facet: {
        records: [{ $skip: skip }, { $limit: perPage }],
        totalCount: [{ $count: "count" }],
      },
    },
  ]);

  const stockGroups = result?.[0]?.records || [];
  const total = result?.[0]?.totalCount?.[0]?.count || 0;

  res.json(
    new ApiResponse(
      200,
      {
        stockGroups,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      stockGroups.length ? "Stock Groups fetched successfully" : "No Stock Groups found"
    )
  );
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

