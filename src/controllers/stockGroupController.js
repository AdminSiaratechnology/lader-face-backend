// controllers/stockGroupController.js
const crypto = require("crypto");
const StockGroup = require("../models/StockGroup");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const {generateUniqueId} =require("../utils/generate16DigiId")
const mongoose=require("mongoose")



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

  // Sirf clientID field hi le aayenge
  const agentDetail = await User.findById(agentId, { clientID: 1 });

  if (!agentDetail || !agentDetail.clientID) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  const clientId = agentDetail.clientID;

  // Generate unique stockGroupId
  const stockGroupId = await generateUniqueId(StockGroup,"stockGroupId");

  // Create stock group
  const stockGroup = await StockGroup.create({
    clientId,
    companyId,
    stockGroupId,
    name,
    description,
    createdBy: agentId,
    auditLogs: [
      {
        action: "create",
        performedBy: agentId ? new mongoose.Types.ObjectId(agentId) : null,
        timestamp: new Date(),
        details: "Stock Group created",
      },
    ],
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
        localField: "clientID",
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

  // ✅ Required field check
  if (!companyId || !name) {
    throw new ApiError(400, "Company ID and name are required");
  }

  // ✅ Agent permission check
  const agentDetail = await User.findById(agentId, { clientID: 1 });
  if (!agentDetail || !agentDetail.clientID) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  // ✅ Find existing StockGroup
  const stockGroup = await StockGroup.findById(req.params.id);
  if (!stockGroup) throw new ApiError(404, "Stock Group not found");

  // ✅ Allowed fields for update
  const allowedFields = ["companyId", "name", "description"];
  const updateData = {};
  Object.keys(req.body || {}).forEach(key => {
    if (allowedFields.includes(key)) updateData[key] = req.body[key];
  });

  // ✅ Track changes for audit log
  const oldData = stockGroup.toObject();
  const changes = {};
  Object.keys(updateData).forEach(key => {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(updateData[key])) {
      changes[key] = { from: oldData[key], to: updateData[key] };
    }
  });

  // ✅ Apply updates
  Object.assign(stockGroup, updateData);

  // ✅ Audit log
  if (!stockGroup.auditLogs) stockGroup.auditLogs = [];
  stockGroup.auditLogs.push({
    action: "update",
    performedBy: agentId,
    details: "Stock Group updated",
    changes,
    timestamp: new Date()
  });

  // ✅ Save
  await stockGroup.save();

  res.json(new ApiResponse(200, stockGroup, "Stock Group updated successfully"));
});


// Delete
exports.deleteStockGroup = asyncHandler(async (req, res) => {
  const agentId = req.user.id;
  const { id } = req.params;

  // Sirf clientID field hi le aayenge
  const agentDetail = await User.findById(agentId, { clientID: 1 });

  if (!agentDetail || !agentDetail.clientID) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  // Stock group exist check
  const stock = await StockGroup.findById(id);
  if (!stock) {
    throw new ApiError(404, "Stock Group not found");
  }

  // Soft delete update
  stock.status = "Delete";
     stock.auditLogs.push({
              action: "delete",
              performedBy: new mongoose.Types.ObjectId(req.user.id),
              timestamp: new Date(),
              details: "Stock Group marked as deleted",
            });
  await stock.save();

  res.json(new ApiResponse(200, stock, "Stock Group deleted successfully"));
});

