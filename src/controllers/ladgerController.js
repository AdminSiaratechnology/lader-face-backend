
const Ledger = require('../models/Ladger')
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
// const { generateUniqueId } = require('../utils/generate16DigiId');
const mongoose = require('mongoose');
const   {createAuditLog}=require("../utils/createAuditLog")
const { generateUniqueId } = require('../utils/generate16DigiId');

// Generate unique 18-digit code using timestamp and index
// const generateUniqueId = (index) => {
//   const timestamp = Date.now();
//   const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
//   return `${timestamp}${index.toString().padStart(4, '0')}${random}`.slice(-18); // 18-digit code
// };

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
      const inserted = await Ledger.insertMany(batch, { ordered: false });
      if (inserted && Array.isArray(inserted)) {
        results.push(...inserted);
        console.log(`Inserted ${inserted.length} records in batch`);
      } else {
        console.error('No records inserted in batch');
      }
    } catch (error) {
      if (error.name === 'MongoBulkWriteError' && error.code === 11000) {
        const failedDocs = error.writeResult?.result?.writeErrors?.map(err => ({
          code: err.op.ledgerCode,
          error: err.errmsg
        })) || [];
        const successfulDocs = batch.filter(doc => !failedDocs.some(f => f.code === doc.ledgerCode));
        results.push(...successfulDocs.map(doc => ({ ...doc, _id: doc._id || new mongoose.Types.ObjectId() })));
        failedDocs.forEach(failed => {
          console.error(`Failed to insert record with ledgerCode ${failed.code}: ${failed.error}`);
        });
      } else {
        console.error(`Batch insertion failed: ${error.message}`);
      }
    }
  }

  // Verify inserted records
  const insertedIds = results.map(doc => doc._id);
  const verifiedDocs = insertedIds.length > 0 ? await Ledger.find({ _id: { $in: insertedIds } }) : [];
  console.log(`Verified ${verifiedDocs.length} records in database`);
  return verifiedDocs;
};


// 🟢 Create Ledger
exports.createLedger = asyncHandler(async (req, res) => {
  const {
    ledgerName,
    emailAddress,
    phoneNumber,
    companyID, // company reference
    ...rest
  } = req.body;

  if (!ledgerName) {
    throw new ApiError(400, "Ledger name and code are required");
  }
  const clientId = req.user.clientID;

  let logoUrl = null;
  let registrationDocs = [];

  // Logo file
  if (req?.files?.['logo'] && req?.files?.['logo'][0]) {
    logoUrl = req.files['logo'][0].location;
  }

  // Registration docs files
     let registrationDocTypes;
    try {
      registrationDocTypes = JSON.parse(req.body.registrationDocTypes || '[]');
    } catch (e) {
      console.error('Failed to parse registrationDocTypes:', e);
      registrationDocTypes = [];
    }

    if (req?.files?.['registrationDocs']) {
      registrationDocs = req?.files['registrationDocs'].map((file, index) => ({
        type: registrationDocTypes[index] || 'Other',
        file: file.location,
        fileName: file.originalname
      }));
    }
  let ledgerCode = await generateUniqueId(Ledger, "ledgerCode");

  const ledger = await Ledger.create({
    ledgerName,
    ledgerCode,
    clientId,
    emailAddress,
    phoneNumber,
    // companyID,
    ...rest,
    logo: logoUrl || "",
    registrationDocs: registrationDocs || [],
    banks: JSON.parse(req.body.banks),
    company: companyID,
    createdBy: req?.user?.id,
    auditLogs: [
      {
        action: "create",
        performedBy: new mongoose.Types.ObjectId(req.user.id),
        timestamp: new Date(),
        details: "Ledger created",
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
    module: "Ledger",
    action: "create",
    performedBy: req.user.id,
    referenceId: ledger._id,
    clientId,
    details: "ledger created successfully",
    ipAddress,
  });

  res
    .status(201)
    .json(new ApiResponse(201, ledger, "Ledger created successfully"));
});

exports.createBulkLedgers = asyncHandler(async (req, res) => {
  console.log("Processing ledgers");
  const { ledgers } = req.body;

  // Validate input
  if (!Array.isArray(ledgers) || ledgers.length === 0) {
    throw new ApiError(400, "Ledgers array is required in body");
  }

  // Validate user
  const userId = req.user.id;
  const user = await User.findById(userId);
  console.log(user, "user");
  if (!user) throw new ApiError(404, "User not found");
  const clientId = req.user.clientID;
  if (!clientId) throw new ApiError(400, "Client ID is required from token");

  // Preload company IDs
  const companies = await Company.find({}, "_id");
  const validCompanyIds = new Set(companies.map((c) => String(c._id)));

  // Preload existing ledger codes
  const existingLedgers = await Ledger.find({}, "ledgerCode");
  const existingCodes = new Set(existingLedgers.map(ledger => ledger.ledgerCode));

  const results = [];
  const errors = [];
  const seenCodes = new Set();

  // Process ledgers
  for (const [index, body] of ledgers.entries()) {
    try {
      // Required fields
      if (!body.ledgerName || !body.companyID) {
        throw new Error("ledgerName and companyID are required");
      }
      if (!validCompanyIds.has(String(body.companyID))) {
        throw new Error("Invalid company ID");
      }

      // Generate or validate ledgerCode
      let ledgerCode = body.ledgerCode;
      if (!ledgerCode) {
        ledgerCode = generateUniqueId(index); // Generate 18-digit code
      } else {
        // Check for duplicate ledgerCode in the input batch
        if (seenCodes.has(ledgerCode)) {
          throw new Error("Duplicate ledgerCode within batch");
        }
        // Check for duplicate ledgerCode in the database
        if (existingCodes.has(ledgerCode)) {
          throw new Error("LedgerCode already exists in database");
        }
      }
      seenCodes.add(ledgerCode);

      // Generate unique values for optional fields if not provided
      const emailAddress = body.emailAddress || `${body.ledgerName.replace(/\s+/g, '').toLowerCase()}${index}@gmail.com`;
      const phoneNumber = body.phoneNumber || `+919${(973884720 + index).toString().padStart(9, '0')}`;

      const ledgerObj = {
        _id: new mongoose.Types.ObjectId(), // Generate unique _id
        ledgerName: body.ledgerName,
        ledgerCode,
        clientId,
        emailAddress,
        phoneNumber,
        companyID: body.companyID,
        company: body.companyID,
        createdBy: userId,
        ...body, // Spread other fields from input
        logo: "", // Skipped as per request
        registrationDocs: [], // Skipped as per request
        banks: body.banks ? JSON.parse(body.banks) : [], // Parse banks if provided
        auditLogs: [
          {
            action: "create",
            performedBy: new mongoose.Types.ObjectId(userId),
            timestamp: new Date(),
            details: "Bulk ledger import",
          },
        ],
      };

      results.push(ledgerObj);
    } catch (err) {
      errors.push({
        index,
        ledgerName: body?.ledgerName,
        ledgerCode: body?.ledgerCode,
        error: err.message,
      });
    }
  }

  // Log prepared results
  console.log(`Prepared ${results.length} valid ledgers for insertion`);

  // Batch insert
  const inserted = await insertInBatches(results, 1000);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        totalReceived: ledgers.length,
        totalInserted: inserted.length,
        totalFailed: errors.length,
        insertedIds: inserted.map((l) => l._id),
        errors,
      },
      "Bulk ledger import completed successfully"
    )
  );
});

// 🟢 Update Ledger
exports.updateLedger = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ✅ Step 1: Find existing ledger
  const ledger = await Ledger.findById(id);
  if (!ledger) throw new ApiError(404, "Ledger not found");

  let logoUrl = ledger.logo;
  let registrationDocs = ledger.registrationDocs;
  let banks = ledger.banks;

  // ✅ Step 2: Replace logo if new one uploaded
  if (req?.files?.["logo"] && req?.files?.["logo"][0]) {
    logoUrl = req.files["logo"][0].location;
  }

  // ✅ Step 3: Replace registration docs if new ones uploaded
  if (req?.files?.["registrationDocs"]) {
    registrationDocs = req.files["registrationDocs"].map((file) => ({
      type: req.body.docType || "Other",
      file: file.location,
      fileName: file.originalname,
    }));
  }

  // ✅ Step 4: Prepare updateData
  const updateData = {
    ...req.body,
    logo: logoUrl,
    registrationDocs,
  };

  // ✅ Step 5: Safely parse banks
  if (req.body.banks) {
    try {
      banks =
        typeof req.body.banks === "string"
          ? JSON.parse(req.body.banks)
          : req.body.banks;
      updateData.banks = banks;
    } catch (err) {
      throw new ApiError(400, "Invalid banks data");
    }
  }

  // ✅ Step 6: Track field changes before update
  const oldData = ledger.toObject();
  const changes = {};

  Object.keys(updateData).forEach((key) => {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(updateData[key])) {
      changes[key] = { from: oldData[key], to: updateData[key] };
    }
  });

  // ✅ Step 7: Prevent auditLogs overwrite
  if (updateData.auditLogs) {
    delete updateData.auditLogs;
  }

  // ✅ Step 8: Apply updates safely
  for (const key in updateData) {
    ledger[key] = updateData[key];
  }

  // ✅ Step 9: Push new audit log entry
  ledger.auditLogs.push({
    action: "update",
    performedBy: req.user?.id || null,
    details: "Ledger updated successfully",
    changes,
  });

  // ✅ Step 10: Save ledger document
  await ledger.save();
   let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "Ledger",
    action: "update",
    performedBy: req.user.id,
    referenceId: ledger._id,
    clientId: req.user.clientID,
    details: "ledger updated successfully",
    changes,
    ipAddress,
  });

  res
    .status(200)
    .json(new ApiResponse(200, ledger, "Ledger updated successfully"));
});


// 🟢 Get All Ledgers (for a company)
exports.getLedgersByCompany = asyncHandler(async (req, res) => {
  const clientID = req.user.clientID;
  if (!clientID) throw new ApiError(400, "ClientId is required");


  const {
    search = "",
    status = "",
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 10
  } = req.query;
      const { companyId } = req.params;
   if (!companyId) throw new ApiError(400, "Company ID is required");
   console.log("hiiiiiiiioi",companyId)

  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;

  // Filter
  const filter = { clientId: clientID,company:companyId, status: { $ne: "delete" } };
  if (status && status.trim() !== "") filter.status = status;

  if (search && search.trim() !== "") {
    filter.$or = [
      { ledgerName: { $regex: search, $options: "i" } },
      { emailAddress: { $regex: search, $options: "i" } },
      { phoneNumber: { $regex: search, $options: "i" } },
    ];
  }

  // Sorting
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };

  // Query
  const [ledgers, total] = await Promise.all([
    Ledger.find(filter).select("-auditLogs").sort(sortOptions).skip(skip).limit(perPage),
    Ledger.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        ledgers,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      ledgers.length ? "Ledgers fetched successfully" : "No ledgers found"
    )
  );
});


// 🟢 Get All Ledgers (for a client)
exports.getLedgersByClient = asyncHandler(async (req, res) => {
  const clientID = req.user.clientID;
  if (!clientID) throw new ApiError(400, "ClientId is required");

  const {
    search = "",
    status = "",
    sortBy = "name",
    sortOrder = "asc",
    page = 1,
    limit = 10,
  } = req.query;

  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;

  // Filter
  const filter = { clientId: clientID, status: { $ne: "delete" } };
  if (status && status.trim() !== "") filter.status = status;

  if (search && search.trim() !== "") {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { contactNumber: { $regex: search, $options: "i" } },
    ];
  }

  // Sorting
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };

  // Query
  const [ledgers, total] = await Promise.all([
    Ledger.find(filter).select("-auditLogs").sort(sortOptions).skip(skip).limit(perPage),
    Ledger.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        ledgers,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      ledgers.length ? "Ledgers fetched successfully" : "No ledgers found"
    )
  );
});


// 🟢 Get Single Ledger
exports.getLedgerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ledger = await Ledger.findById(id).populate("company");
  if (!ledger) throw new ApiError(404, "Ledger not found");

  res
    .status(200)
    .json(new ApiResponse(200, ledger, "Ledger fetched successfully"));
});

// 🟢 Delete Ledger
exports.deleteLedger = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if id is passed
  if (!id) {
    throw new ApiError(400, "Ledger ID is required");
  }

  // Find ledger
  const ledger = await Ledger.findById(id);
  if (!ledger) {
    throw new ApiError(404, "Ledger not found");
  }

  // Check permission
  if (String(ledger.clientId) !== String(req.user.clientID)) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  // Soft delete
  ledger.status = "delete";
  ledger.auditLogs.push({
              action: "delete",
              performedBy: new mongoose.Types.ObjectId(req.user.id),
              timestamp: new Date(),
              details: "Ledger marked as deleted",
            });
  await ledger.save();
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
    await createAuditLog({
    module: "Ledger",
    action: "delete",
    performedBy: req.user.id,
    referenceId: ledger._id,
    clientId: req.user.clientID,
    details: "ledger marked as deleted",
    ipAddress,
  });


  // Send response
  res.status(200).json({
    success: true,
    message: "Ledger deleted successfully",
    data: ledger,
  });
});