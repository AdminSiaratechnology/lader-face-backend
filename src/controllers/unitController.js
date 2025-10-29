const Unit = require('../models/Unit');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const User = require('../models/User');
const mongoose = require('mongoose');
const   {createAuditLog}=require("../utils/createAuditLog")

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
      const inserted = await Unit.insertMany(batch, { ordered: false });
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
  const verifiedDocs = insertedIds.length > 0 ? await Unit.find({ _id: { $in: insertedIds } }) : [];
  console.log(`Verified ${verifiedDocs.length} records in database`);
  return verifiedDocs;
};

// ✅ Create Unit
exports.createUnit = asyncHandler(async (req, res) => {
    // res.status(200).json({ message: "Create Unit - Not Implemented" });
    const agentId=req.user.id;
  const {  companyId, name, type, symbol, decimalPlaces, firstUnit, conversion, secondUnit,UQC } = req.body;

  if ( !companyId || !name || !type) {
    throw new ApiError(400, "clientId, companyId, name and type are required");

  }
  

 

  // Sirf clientID field hi le aayenge
  const agentDetail = await User.findById(agentId, { clientID: 1 });

  if (!agentDetail || !agentDetail.clientID) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  const clientId = agentDetail.clientID;

  const unit = await Unit.create({
    clientId, companyId, name, type,
    symbol, decimalPlaces,
    firstUnit, conversion, secondUnit,
    UQC,
    createdBy: agentId,
    auditLogs: [
      {
        action: "create",
        performedBy: agentId ? new mongoose.Types.ObjectId(agentId) : null,
        timestamp: new Date(),
        details: "Unit created",
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
    module: "Unit",
    action: "create",
    performedBy: req.user.id,
    referenceId: unit._id,
    clientId:req.user.clientID,
    details: "Unit created successfully",
    ipAddress,
  });

  res.status(201).json(new ApiResponse(201, unit, "Unit created successfully"));
});

exports.createBulkUnits = asyncHandler(async (req, res) => {
  console.log("Processing units", req.body);
  const { units } = req.body;

  // Validate input
  if (!Array.isArray(units) || units.length === 0) {
    throw new ApiError(400, "Units array is required in body");
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

  const results = [];
  const errors = [];

  // Process units
  for (const [index, body] of units.entries()) {
    try {
      // Required fields
      if (!body.name || !body.companyId || !body.type) {
        throw new Error("name, companyId, and type are required");
      }
      if (!validCompanyIds.has(String(body.companyId))) {
        throw new Error("Invalid company ID");
      }

      // Generate unique values for optional fields if not provided
      const symbol = body.symbol || body.name.charAt(0).toUpperCase();
      const decimalPlaces = body.decimalPlaces || 0;
      const firstUnit = body.firstUnit || "";
      const conversion = body.conversion || 1;
      const secondUnit = body.secondUnit || "";
      const UQC = body.UQC || "";

      const unitObj = {
        _id: new mongoose.Types.ObjectId(), // Generate unique _id
        clientId,
        companyId: body.companyId,
        name: body.name,
        type: body.type,
        symbol,
        decimalPlaces,
        firstUnit,
        conversion,
        secondUnit,
        UQC,
        createdBy: userId,
        auditLogs: [
          {
            action: "create",
            performedBy: new mongoose.Types.ObjectId(userId),
            timestamp: new Date(),
            details: "Bulk unit import",
          },
        ],
      };

      results.push(unitObj);
    } catch (err) {
      errors.push({
        index,
        name: body?.name,
        error: err.message,
      });
    }
  }

  // Log prepared results
  console.log(`Prepared ${results.length} valid units for insertion`);

  // Batch insert
  const inserted = await insertInBatches(results, 1000);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        totalReceived: units.length,
        totalInserted: inserted.length,
        totalFailed: errors.length,
        insertedIds: inserted.map((u) => u._id),
        errors,
      },
      "Bulk unit import completed successfully"
    )
  );
});

// ✅ Update Unit
exports.updateUnit = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ✅ Step 1: Find existing unit
  const unit = await Unit.findById(id);
  if (!unit) throw new ApiError(404, "Unit not found");

  // ✅ Step 2: Allowed fields for update
  const allowedFields = [
    "name",
    "type",
    "symbol",
    "decimalPlaces",
    "UQC",
    "firstUnit",
    "conversion",
    "secondUnit",
    "status"
  ];

  const updateData = {};
  Object.keys(req.body || {}).forEach(key => {
    if (allowedFields.includes(key)) updateData[key] = req.body[key];
  });

  // ✅ Step 3: Track changes for audit log
  const oldData = unit.toObject();
  const changes = {};
  Object.keys(updateData).forEach(key => {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(updateData[key])) {
      changes[key] = { from: oldData[key], to: updateData[key] };
    }
  });

  // ✅ Step 4: Apply updates
  Object.assign(unit, updateData);

  // ✅ Step 5: Push audit log
  if (!unit.auditLogs) unit.auditLogs = [];
  unit.auditLogs.push({
    action: "update",
    performedBy: req.user?.id || null,
    details: "Unit updated",
    changes,
    timestamp: new Date()
  });

  // ✅ Step 6: Save
  await unit.save();
   let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "Unit",
    action: "update",
    performedBy: req.user.id,
    referenceId: unit._id,
    clientId: req.user.clientID,
    details: "Unit updated successfully",
    changes,
    ipAddress,
  });

  res.status(200).json(new ApiResponse(200, unit, "Unit updated successfully"));
});


// ✅ Delete Unit
exports.deleteUnit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const unit = await Unit.findByIdAndDelete(id,);

  if (!unit) throw new ApiError(404, "Unit not found");

let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
    await createAuditLog({
    module: "Unit",
    action: "delete",
    performedBy: req.user.id,
    referenceId: unit._id,
    clientId: req.user.clientID,
    details: "Unit marked as deleted",
    ipAddress,
  });


  res.status(200).json(new ApiResponse(200, null, "Unit deleted successfully"));
});

// ✅ Get Units (by client & company)
exports.getUnits = asyncHandler(async (req, res) => {
  const { companyId, search, status, sortBy, sortOrder, limit = 10, page = 1 } = req.query;

  const userId = req.user.id;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  let clientId = user.clientID;

  const filter = {};
  if (clientId) filter.clientId = clientId;
  if (companyId) filter.companyId = companyId;
  if (status && status !== "") filter.status = status;

  // 🔍 Search support
  if (search && search.trim() !== "") {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  // 📑 Pagination
  const perPage = parseInt(limit, 10);
  const currentPage = parseInt(page, 10);
  const skip = (currentPage - 1) * perPage;

  // ↕️ Sorting
  const sortField = sortBy || "createdAt";
  const sortDirection = sortOrder === "desc" ? -1 : 1;
  const sortOptions = { [sortField]: sortDirection };

  // Fetch records with pagination
  const [units, total] = await Promise.all([
    Unit.find(filter).sort(sortOptions).skip(skip).limit(perPage),
    Unit.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        units,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      units.length ? "Units fetched successfully" : "No Units found"
    )
  );
});
exports.getUnitsByCompanyId = asyncHandler(async (req, res) => {
    const { companyId, search, status, sortBy, sortOrder, limit = 10, page = 1 } = req.query;
   

  const userId = req.user.id;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  let clientId = user.clientID;

  const filter = {};
  if (clientId) filter.clientId = clientId;
  if (companyId) filter.companyId = companyId;
  if (status && status !== "") filter.status = status;

  // 🔍 Search support
  if (search && search.trim() !== "") {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  // 📑 Pagination
  const perPage = parseInt(limit, 10);
  const currentPage = parseInt(page, 10);
  const skip = (currentPage - 1) * perPage;

  // ↕️ Sorting
  const sortField = sortBy || "createdAt";
  const sortDirection = sortOrder === "desc" ? -1 : 1;
  const sortOptions = { [sortField]: sortDirection };

  // Fetch records with pagination
  const [units, total] = await Promise.all([
    Unit.find(filter).sort(sortOptions).skip(skip).limit(perPage),
    Unit.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        units,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      units.length ? "Units fetched successfully" : "No Units found"
    )
  );
});

