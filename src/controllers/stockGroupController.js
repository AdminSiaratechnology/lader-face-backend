// controllers/stockGroupController.js
const crypto = require("crypto");
const StockGroup = require("../models/StockGroup");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
// const {generateUniqueId} =require("../utils/generate16DigiId")
const mongoose = require("mongoose");
const { createAuditLog } = require("../utils/createAuditLog");
const { generate6DigitUniqueId } = require("../utils/generate6DigitUniqueId");

// Generate unique 18-digit code using timestamp and index
const generateUniqueId = (index) => {
  const timestamp = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
  return `${timestamp}${index.toString().padStart(4, "0")}${random}`.slice(-18); // 18-digit code
};

// Insert records in batches with robust error handling
const insertInBatches = async (data, batchSize) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.error("No valid data to insert");
    return [];
  }

  const results = [];
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    if (!batch || !Array.isArray(batch) || batch.length === 0) {
      console.error(`Invalid batch at index ${i}`);
      continue;
    }

    console.log(`Inserting batch of ${batch.length} records`);
    try {
      const inserted = await StockGroup.insertMany(batch, { ordered: false });
      if (inserted && Array.isArray(inserted)) {
        results.push(...inserted);
        console.log(`Inserted ${inserted.length} records in batch`);
      } else {
        console.error("No records inserted in batch");
      }
    } catch (error) {
      if (error.name === "MongoBulkWriteError" && error.code === 11000) {
        const failedDocs =
          error.writeResult?.result?.writeErrors?.map((err) => ({
            code: err.op.stockGroupId,
            error: err.errmsg,
          })) || [];
        const successfulDocs = batch.filter(
          (doc) => !failedDocs.some((f) => f.code === doc.stockGroupId)
        );
        results.push(
          ...successfulDocs.map((doc) => ({
            ...doc,
            _id: doc._id || new mongoose.Types.ObjectId(),
          }))
        );
        failedDocs.forEach((failed) => {
          console.error(
            `Failed to insert record with stockGroupId ${failed.code}: ${failed.error}`
          );
        });
      } else {
        console.error(`Batch insertion failed: ${error.message}`);
      }
    }
  }

  // Verify inserted records
  const insertedIds = results.map((doc) => doc._id);
  const verifiedDocs =
    insertedIds.length > 0
      ? await StockGroup.find({ _id: { $in: insertedIds } })
      : [];
  console.log(`Verified ${verifiedDocs.length} records in database`);
  return verifiedDocs;
};

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
  const { companyId, name, description, parent } = req.body;

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
  const stockGroupId = await generate6DigitUniqueId(StockGroup, "stockGroupId");
  const code = await generate6DigitUniqueId(StockGroup, "code");
  // Create stock group 
  const stockGroup = await StockGroup.create({
    clientId,
    companyId,
    stockGroupId,
    code,
    parent,
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
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }

  console.log(ipAddress, "ipaddress");
  await createAuditLog({
    module: "StockGroup",
    action: "create",
    performedBy: req.user.id,
    referenceId: stockGroup._id,
    clientId: req.user.clientID,
    details: "Customer created successfully",
    ipAddress,
  });

  res
    .status(201)
    .json(new ApiResponse(201, stockGroup, "Stock Group created successfully"));
});

exports.createBulkStockGroups = asyncHandler(async (req, res) => {
  console.log("Processing stock groups", req.body);
  const { stockGroups } = req.body;

  // Validate input
  if (!Array.isArray(stockGroups) || stockGroups.length === 0) {
    throw new ApiError(400, "StockGroups array is required in body");
  }

  // Validate user
  const userId = req.user.id;
  const user = await User.findById(userId, { clientID: 1 }).lean();
  console.log(user, "user");
  if (!user || !user.clientID) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }
  const clientId = user.clientID;

  // Preload company IDs
  const companies = await Company.find({}, "_id");
  const validCompanyIds = new Set(companies.map((c) => String(c._id)));

  // Preload existing stock group IDs
  const existingStockGroups = await StockGroup.find({}, "stockGroupId");
  const existingCodes = new Set(
    existingStockGroups.map((stockGroup) => stockGroup.stockGroupId)
  );

  const results = [];
  const errors = [];
  const seenCodes = new Set();

  // Process stock groups
  for (const [index, body] of stockGroups.entries()) {
    try {
      // Required fields
      if (!body.name || !body.companyId) {
        throw new Error("name and companyId are required");
      }
      if (!validCompanyIds.has(String(body.companyId))) {
        throw new Error("Invalid company ID");
      }

      // Generate or validate stockGroupId
      let stockGroupId = body.stockGroupId;
      if (!stockGroupId) {
        stockGroupId = generateUniqueId(index); // Generate 18-digit code
      } else {
        // Check for duplicate stockGroupId in the input batch
        if (seenCodes.has(stockGroupId)) {
          throw new Error("Duplicate stockGroupId within batch");
        }
        // Check for duplicate stockGroupId in the database
        if (existingCodes.has(stockGroupId)) {
          throw new Error("StockGroupId already exists in database");
        }
      }
      seenCodes.add(stockGroupId);

      // Generate unique values for optional fields if not provided
      const description = body.description || `Stock Group ${index + 1}`;

      const stockGroupObj = {
        _id: new mongoose.Types.ObjectId(), // Generate unique _id
        clientId,
        companyId: body.companyId,
        stockGroupId,
        name: body.name,
        description,
        createdBy: userId,
        auditLogs: [
          {
            action: "create",
            performedBy: new mongoose.Types.ObjectId(userId),
            timestamp: new Date(),
            details: "Bulk stock group import",
          },
        ],
      };

      results.push(stockGroupObj);
    } catch (err) {
      errors.push({
        index,
        name: body?.name,
        stockGroupId: body?.stockGroupId,
        error: err.message,
      });
    }
  }

  // Log prepared results
  console.log(`Prepared ${results.length} valid stock groups for insertion`);

  // Batch insert
  const inserted = await insertInBatches(results, 1000);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        totalReceived: stockGroups.length,
        totalInserted: inserted.length,
        totalFailed: errors.length,
        insertedIds: inserted.map((sg) => sg._id),
        errors,
      },
      "Bulk stock group import completed successfully"
    )
  );
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
    { $unwind: { path: "$parent" }, preserveNullAndEmptyArrays: false },
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
      stockGroups.length
        ? "Stock Groups fetched successfully"
        : "No Stock Groups found"
    )
  );
});
exports.getStockGroupsByCompany = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { search, status, sortBy, sortOrder, limit = 10, page = 1 } = req.query;
  const { companyId } = req.params;
  if (!companyId) throw new ApiError(400, "company id required");

  const perPage = parseInt(limit, 10);
  const currentPage = parseInt(page, 10);
  const skip = (currentPage - 1) * perPage;
  console.log(companyId, "companyid");

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
          {
            $match: {
              status: { $ne: "delete" },
              ...(companyId
                ? { companyId: new mongoose.Types.ObjectId(companyId) } // ✅ only add if valid
                : {}),
            },
          },
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
              const field = sortBy === "name" ? "name" : "createdAt";
              const order = sortOrder === "asc" ? 1 : -1;
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

        stats: [
          {
            $group: {
              _id: null,
              totalPrimary: {
                $sum: { $cond: [{ $eq: ["$parent", null] }, 1, 0] },
              },
              totalActive: {
                $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
              },
              totalInactive: {
                $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
              },
            },
          },
        ],
      },
    },
  ]);

  const stockGroups = result?.[0]?.records || [];
  const total = result?.[0]?.totalCount?.[0]?.count || 0;
  const stats = result?.[0]?.stats?.[0] || {};

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
        counts: {
          totalPrimary: stats.totalPrimary || 0,
          totalActive: stats.totalActive || 0,
          totalInactive: stats.totalInactive || 0,
        },
      },
      stockGroups.length
        ? "Stock Groups fetched successfully"
        : "No Stock Groups found"
    )
  );
});

// Update
exports.updateStockGroup = asyncHandler(async (req, res) => {
  const agentId = req.user.id;
  const { companyId, name, description, status, parent } = req.body;

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
  const allowedFields = [
    "companyId",
    "name",
    "description",
    "status",
    "parent",
  ];
  const updateData = {};
  Object.keys(req.body || {}).forEach((key) => {
    if (allowedFields.includes(key)) updateData[key] = req.body[key];
  });

  // ✅ Track changes for audit log
  const oldData = stockGroup.toObject();
  const changes = {};
  Object.keys(updateData).forEach((key) => {
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
    timestamp: new Date(),
  });

  // ✅ Save
  await stockGroup.save();

  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "StockGroup",
    action: "update",
    performedBy: req.user.id,
    referenceId: stockGroup._id,
    clientId: req.user.clientID,
    details: "stockGroup updated successfully",
    changes,
    ipAddress,
  });

  res.json(
    new ApiResponse(200, stockGroup, "Stock Group updated successfully")
  );
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
  stock.status = "delete";
  stock.auditLogs.push({
    action: "delete",
    performedBy: new mongoose.Types.ObjectId(req.user.id),
    timestamp: new Date(),
    details: "Stock Group marked as deleted",
  });
  await stock.save();
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "StockGroup",
    action: "delete",
    performedBy: req.user.id,
    referenceId: stock._id,
    clientId: req.user.clientID,
    details: "stockGroup marked as deleted",
    ipAddress,
  });

  res.json(new ApiResponse(200, stock, "Stock Group deleted successfully"));
});
