// controllers/stockCategoryController.js
const crypto = require("crypto");
const StockCategory = require("../models/StockCategory");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const { default: mongoose } = require("mongoose");
const   {createAuditLog}=require("../utils/createAuditLog")

// ===== Helpers ===== //
const ensureFound = (doc, message = "Resource not found") => {
  if (!doc) throw new ApiError(404, message);
  return doc;
};
// Insert records in batches with robust error handling
const insertInBatches = async (data, batchSize) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.error('No valid data to insert');
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
      const inserted = await StockCategory.insertMany(batch, { ordered: false });
      if (inserted && Array.isArray(inserted)) {
        results.push(...inserted);
        console.log(`Inserted ${inserted.length} records in batch`);
      } else {
        console.error('No records inserted in batch');
      }
    } catch (error) {
      if (error.name === 'MongoBulkWriteError' && error.code === 11000) {
        const failedDocs = error.writeResult?.result?.writeErrors?.map(err => ({
          name: err.op.name,
          error: err.errmsg
        })) || [];
        const successfulDocs = batch.filter(doc => !failedDocs.some(f => f.name === doc.name));
        results.push(...successfulDocs.map(doc => ({ ...doc, _id: doc._id || new mongoose.Types.ObjectId() })));
        failedDocs.forEach(failed => {
          console.error(`Failed to insert record with name ${failed.name}: ${failed.error}`);
        });
      } else {
        console.error(`Batch insertion failed: ${error.message}`);
      }
    }
  }

  // Verify inserted records
  const insertedIds = results.map(doc => doc._id);
  const verifiedDocs = insertedIds.length > 0 ? await StockCategory.find({ _id: { $in: insertedIds } }) : [];
  console.log(`Verified ${verifiedDocs.length} records in database`);
  return verifiedDocs;
};

exports.createStockCategory = asyncHandler(async (req, res) => {
  const { companyId, name, description } = req.body;
  const agentId = req.user.id;

  // Required fields
  if (!companyId || !name) {
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
    name,
    description,
    status: "active",
    createdBy: agentId,
    auditLogs: [
      {
        action: "create",
        performedBy: agentId ? new mongoose.Types.ObjectId(agentId) : null,
        timestamp: new Date(),
        details: "Stock Category created",
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
    module: "StockCategory",
    action: "create",
    performedBy: req.user.id,
    referenceId: category._id,
    clientId:req.user.clientID,
    details: "Stock Category created successfully",
    ipAddress,
  });

  res.status(201).json(new ApiResponse(201, category, "Stock Category created successfully"));
});

exports.createBulkStockCategories = asyncHandler(async (req, res) => {
  console.log("Processing stock categories", req.body);
  const { stockCategories } = req.body;

  // Validate input
  if (!Array.isArray(stockCategories) || stockCategories.length === 0) {
    throw new ApiError(400, "StockCategories array is required in body");
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

  // Preload stock group IDs
  const stockGroups = await StockGroup.find({}, "_id");
  const validStockGroupIds = new Set(stockGroups.map((sg) => String(sg._id)));

  const results = [];
  const errors = [];

  // Process stock categories
  for (const [index, body] of stockCategories.entries()) {
    try {
      // Required fields
      if (!body.name || !body.companyId || !body.stockGroupId) {
        throw new Error("name, companyId, and stockGroupId are required");
      }
      if (!validCompanyIds.has(String(body.companyId))) {
        throw new Error("Invalid company ID");
      }
      if (!validStockGroupIds.has(String(body.stockGroupId))) {
        throw new Error("Invalid stock group ID");
      }

      // Generate unique values for optional fields if not provided
      const description = body.description || `Stock Category ${index + 1}`;

      const stockCategoryObj = {
        _id: new mongoose.Types.ObjectId(), // Generate unique _id
        clientId,
        companyId: body.companyId,
        stockGroupId: body.stockGroupId,
        name: body.name,
        description,
        status: body.status || "Active",
        createdBy: userId,
        auditLogs: [
          {
            action: "create",
            performedBy: new mongoose.Types.ObjectId(userId),
            timestamp: new Date(),
            details: "Bulk stock category import",
          },
        ],
      };

      results.push(stockCategoryObj);
    } catch (err) {
      errors.push({
        index,
        name: body?.name,
        error: err.message,
      });
    }
  }

  // Log prepared results
  console.log(`Prepared ${results.length} valid stock categories for insertion`);

  // Batch insert
  const inserted = await insertInBatches(results, 1000);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        totalReceived: stockCategories.length,
        totalInserted: inserted.length,
        totalFailed: errors.length,
        insertedIds: inserted.map((sc) => sc._id),
        errors,
      },
      "Bulk stock category import completed successfully"
    )
  );
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
    .select("-auditLogs")
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
exports.getStockCategoriesByCompanyId = asyncHandler(async (req, res) => {
  
  const {  stockGroupId, search, status, sortBy, sortOrder, limit = 10, page = 1 } = req.query;
  const {companyId}=req.params
  if(!companyId) throw new ApiError(400,"company id is required")

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
    .select("-auditLogs")
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

  // ✅ Find existing StockCategory
  const stockCategory = await StockCategory.findById(id);
  if (!stockCategory) throw new ApiError(404, "Stock Category not found");

  // ✅ Allowed fields for update
  const allowedFields = ["companyId", "name", "description", "status"];
  const updateData = {};
  Object.keys(req.body || {}).forEach(key => {
    if (allowedFields.includes(key)) updateData[key] = req.body[key];
  });

  // ✅ Track changes for audit log
  const oldData = stockCategory.toObject();
  const changes = {};
  Object.keys(updateData).forEach(key => {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(updateData[key])) {
      changes[key] = { from: oldData[key], to: updateData[key] };
    }
  });

  // ✅ Apply updates
  Object.assign(stockCategory, updateData);

  // ✅ Audit log
  if (!stockCategory.auditLogs) stockCategory.auditLogs = [];
  stockCategory.auditLogs.push({
    action: "update",
    performedBy: req.user?.id || null,
    details: "Stock Category updated",
    changes,
    timestamp: new Date()
  });

  // ✅ Save
  await stockCategory.save();

   let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "StockCategory",
    action: "update",
    performedBy: req.user.id,
    referenceId: stockCategory._id,
    clientId: req.user.clientID,
    details: "Stock Category updated successfully",
    changes,
    ipAddress,
  });

  res.json(new ApiResponse(200, stockCategory, "Stock Category updated successfully"));
});


// Delete Stock Category (Soft delete → status: "Delete")
exports.deleteStockCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await StockCategory.findById(id);
  ensureFound(category, "Stock Category not found");

  category.status = "delete";
  const agentId = req.user.id;
  category.auditLogs.push({
    action: "delete",
    performedBy: agentId ? new mongoose.Types.ObjectId(agentId) : null,
    timestamp: new Date(),
    details: "Stock Category deleted",
  });
  await category.save();
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
    await createAuditLog({
    module: "StockCategory",
    action: "delete",
    performedBy: req.user.id,
    referenceId: category._id,
    clientId: req.user.clientID,
    details: "stockCategory marked as deleted",
    ipAddress,
  });


  res.json(new ApiResponse(200, category, "Stock Category deleted successfully"));
});
