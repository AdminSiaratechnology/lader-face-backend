const Vendor = require('../models/Vendor');
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
// const { generateUniqueId } = require('../utils/generate16DigiId');
const mongoose = require('mongoose');
const   {createAuditLog}=require("../utils/createAuditLog")


// Generate unique 18-digit code using timestamp and index
const generateUniqueId = (index) => {
  const timestamp = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
  return `${timestamp}${index.toString().padStart(4, '0')}${random}`.slice(-18); // 18-digit code
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
      const inserted = await Vendor.insertMany(batch, { ordered: false });
      if (inserted && Array.isArray(inserted)) {
        results.push(...inserted);
        console.log(`Inserted ${inserted.length} records in batch`);
      } else {
        console.error('No records inserted in batch');
      }
    } catch (error) {
      if (error.name === 'MongoBulkWriteError' && error.code === 11000) {
        const failedDocs = error.writeResult?.result?.writeErrors?.map(err => ({
          code: err.op.code,
          error: err.errmsg
        })) || [];
        const successfulDocs = batch.filter(doc => !failedDocs.some(f => f.code === doc.code));
        results.push(...successfulDocs.map(doc => ({ ...doc, _id: doc._id || new mongoose.Types.ObjectId() })));
        failedDocs.forEach(failed => {
          console.error(`Failed to insert record with code ${failed.code}: ${failed.error}`);
        });
      } else {
        console.error(`Batch insertion failed: ${error.message}`);
      }
    }
  }

  // Verify inserted records
  const insertedIds = results.map(doc => doc._id);
  const verifiedDocs = insertedIds.length > 0 ? await Vendor.find({ _id: { $in: insertedIds } }) : [];
  console.log(`Verified ${verifiedDocs.length} records in database`);
  return verifiedDocs;
};

// 🟢 Create Vendor
exports.createVendor = asyncHandler(async (req, res) => {
  const {
    vendorName,
    emailAddress,
    phoneNumber,
    companyID, // company reference
    ...rest
  } = req.body;

  if (!vendorName) {
    throw new ApiError(400, "Vendor name and code are required");
  }
  const clientId = req.user.clientID;
  const adminId = req?.user?.id;

  // Company check
  // const existingCompany = await Company.findById(companyID);
  // if (!existingCompany) {
  //   throw new ApiError(404, "Company not found");
  // }

  let logoUrl = null;
  let registrationDocs = [];

  // Logo file
  if (req?.files?.['logo'] && req?.files?.['logo'][0]) {
    logoUrl = req.files['logo'][0].location;
  }
  // console.log(req.files,req.body,"req,files")

  // Registration docs files
  if (req?.files?.['registrationDocs']) {
    registrationDocs = req.files['registrationDocs'].map(file => ({
      type: req.body.docType || 'Other',
      file: file.location,
      fileName: file.originalname
    }));
  }
  let code = await generateUniqueId(Vendor, "code");
  console.log(JSON.parse(req.body.banks), "JSON.parse(req.body.banks)");

  const vendor = await Vendor.create({
    vendorName,
    code,
    clientId,
    emailAddress,
    phoneNumber,
    companyID,
    ...rest,
    logo: logoUrl || "",
    registrationDocs: registrationDocs || [],
    banks: JSON.parse(req.body.banks),
    company: companyID,
        createdBy: adminId,
             auditLogs: [
                  {
                    action: "create",
                    performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
                    timestamp: new Date(),
                    details: "vendor created",
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
    module: "Vendor",
    action: "create",
    performedBy: req.user.id,
    referenceId: vendor._id,
    clientId,
    details: "vendor created successfully",
    ipAddress,
  });

  res
    .status(201)
    .json(new ApiResponse(201, vendor, "Vendor created successfully"));
});

exports.createBulkVendors = asyncHandler(async (req, res) => {
  console.log("Processing vendors");
  const { vendors } = req.body;

  // Validate input
  if (!Array.isArray(vendors) || vendors.length === 0) {
    throw new ApiError(400, "Vendors array is required in body");
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

  // Preload existing codes
  const existingVendors = await Vendor.find({}, "code");
  const existingCodes = new Set(existingVendors.map(vendor => vendor.code));

  const results = [];
  const errors = [];
  const seenCodes = new Set();

  // Process vendors
  for (const [index, body] of vendors.entries()) {
    try {
      // Required fields
      if (!body.vendorName || !body.companyID) {
        throw new Error("vendorName and companyID are required");
      }
      if (!validCompanyIds.has(String(body.companyID))) {
        throw new Error("Invalid company ID");
      }

      // Generate or validate code
      let code = body.code;
      if (!code) {
        code = generateUniqueId(index); // Generate 18-digit code
      } else {
        // Check for duplicate code in the input batch
        if (seenCodes.has(code)) {
          throw new Error("Duplicate code within batch");
        }
        // Check for duplicate code in the database
        if (existingCodes.has(code)) {
          throw new Error("Code already exists in database");
        }
      }
      seenCodes.add(code);

      // Generate unique values for optional fields if not provided
      const emailAddress = body.emailAddress || `${body.vendorName.replace(/\s+/g, '').toLowerCase()}${index}@gmail.com`;
      const phoneNumber = body.phoneNumber || `+919${(973884720 + index).toString().padStart(9, '0')}`;

      const vendorObj = {
        _id: new mongoose.Types.ObjectId(), // Generate unique _id
        vendorName: body.vendorName,
        code,
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
            details: "Bulk vendor import",
          },
        ],
      };

      results.push(vendorObj);
    } catch (err) {
      errors.push({
        index,
        vendorName: body?.vendorName,
        code: body?.code,
        error: err.message,
      });
    }
  }

  // Batch insert
  const inserted = await insertInBatches(results, 1000);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        totalReceived: vendors.length,
        totalInserted: inserted.length,
        totalFailed: errors.length,
        insertedIds: inserted.map((v) => v._id),
        errors,
      },
      "Bulk vendor import completed successfully"
    )
  );
});

// 🟢 Update Vendor
exports.updateVendor = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ✅ Step 1: Find existing vendor
  const vendor = await Vendor.findById(id);
  if (!vendor) throw new ApiError(404, "Vendor not found");

  let logoUrl = vendor.logo;
  let registrationDocs = vendor.registrationDocs;
  let banks = vendor.banks;

  // ✅ Step 2: Replace logo if new one uploaded
  if (req?.files?.['logo'] && req?.files?.['logo'][0]) {
    logoUrl = req.files['logo'][0].location;
  }

  // ✅ Step 3: Replace registration docs if new ones uploaded
  if (req?.files?.['registrationDocs']) {
    registrationDocs = req.files['registrationDocs'].map(file => ({
      type: req.body.docType || 'Other',
      file: file.location,
      fileName: file.originalname
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
      banks = typeof req.body.banks === "string" ? JSON.parse(req.body.banks) : req.body.banks;
      updateData.banks = banks;
    } catch (err) {
      throw new ApiError(400, "Invalid banks data");
    }
  }

  // ✅ Step 6: Track field changes before update
  const oldData = vendor.toObject();
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
    vendor[key] = updateData[key];
  }

  // ✅ Step 9: Push new audit log entry
  vendor.auditLogs.push({
    action: "update",
    performedBy: req.user?.id || null,
    details: "Vendor updated successfully",
    changes,
  });

  // ✅ Step 10: Save vendor document
  await vendor.save();

   let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "Vendor",
    action: "update",
    performedBy: req.user.id,
    referenceId: vendor._id,
    clientId: req.user.clientID,
    details: "vendor updated successfully",
    changes,
    ipAddress,
  });

  res
    .status(200)
    .json(new ApiResponse(200, vendor, "Vendor updated successfully"));
});



// 🟢 Get All Vendors (for a company)
exports.getVendorsByCompany = asyncHandler(async (req, res) => {
  const clientID = req.user.clientID;
  if (!clientID) throw new ApiError(400, "Client ID is required");

  const {
    search = "",
    status = "",
    sortBy = "name",
    sortOrder = "asc",
    page = 1,
    limit = 10
  } = req.query;
     const { companyId } = req.params;
   if (!companyId) throw new ApiError(400, "Company ID is required");

  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;

  // Filter
  const filter = { clientId: clientID,company:companyId, status: { $ne: "Delete" } };
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

  // Fetch data & total count
  const [vendors, total] = await Promise.all([
    Vendor.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(perPage),
    Vendor.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        vendors,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      vendors.length ? "Vendors fetched successfully" : "No vendors found"
    )
  );
});

exports.getVendorsByClient = asyncHandler(async (req, res) => {
  const clientID = req.user.clientID;
  if (!clientID) throw new ApiError(400, "Client ID is required");

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
  const filter = { clientId: clientID, status: { $ne: "Delete" } };
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

  // Fetch data & total count
  const [vendors, total] = await Promise.all([
    Vendor.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(perPage),
    Vendor.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        vendors,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      vendors.length ? "Vendors fetched successfully" : "No vendors found"
    )
  );
});


// 🟢 Get Single Vendor
exports.getVendorById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vendor = await Vendor.findById(id).populate("company");
  if (!vendor) throw new ApiError(404, "Vendor not found");

  res
    .status(200)
    .json(new ApiResponse(200, vendor, "Vendor fetched successfully"));
});

// Delete Vendor
exports.deleteVendor = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // check if id is passed
  if (!id) {
    throw new ApiError(400, "Vendor ID is required");
  }

  // find vendor
  const vendor = await Vendor.findById(id);
  if (!vendor) {
    throw new ApiError(404, "Vendor not found");
  }

  // check permission
  if (String(vendor.clientId) !== String(req.user.clientID)) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  // soft delete
  vendor.status = "Delete";
   vendor.auditLogs.push({
          action: "delete",
          performedBy: new mongoose.Types.ObjectId(req.user.id),
          timestamp: new Date(),
          details: "Vendor marked as deleted",
        });
  
  await vendor.save();
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
    await createAuditLog({
    module: "Vendor",
    action: "delete",
    performedBy: req.user.id,
    referenceId: vendor._id,
    clientId: req.user.clientID,
    details: "vendor marked as deleted",
    ipAddress,
  });


  // send response
  res.status(200).json({
    success: true,
    message: "Vendor deleted successfully",
    data: vendor,
  });
});
