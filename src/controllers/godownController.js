const Godown = require("../models/Godown");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const ApiError = require("../utils/apiError");
const { default: mongoose } = require("mongoose");
const User = require("../models/User");
// const { generateUniqueId } = require("../utils/generate16DigiId");

// Generate unique 18-digit code using timestamp and index
const generateUniqueId = (index) => {
  const timestamp = Date.now();
  const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
  return `${timestamp}${index.toString().padStart(4, '0')}${random}`.slice(-18); // 18-digit code
};

// Insert records in batches with robust error handling
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
      const inserted = await Godown.insertMany(batch, { ordered: false });
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
  const verifiedDocs = insertedIds.length > 0 ? await Godown.find({ _id: { $in: insertedIds } }) : [];
  console.log(`Verified ${verifiedDocs.length} records in database`);
  return verifiedDocs;
};

// ✅ Create Godown
exports.createGodown = asyncHandler(async (req, res) => {
  console.log("Request Body:", req.body); // Debugging line to check incoming data
  const {
    address,
    capacity,
    city,
    
    company,
    contactNumber,
    country,
    isPrimary,
    manager,
    name,
    parent,
    state,
    status,
  } = req.body;
  let code=await generateUniqueId(Godown,"code")

  // ✅ Required fields check
  if (!company || !name) {
    throw new ApiError(400, "Company, Code and Name are required");
  }

  // ✅ Logged-in user check
  const user = await User.findById(req.user.id).lean();
  if (!user) throw new ApiError(404, "User not found");

  // ✅ Extract client from user
  const client = user.clientID;

  // ✅ Create godown
  const godown = await Godown.create({
    address,
    capacity,
    city,
    code,
    company,
    contactNumber,
    country,
    isPrimary,
    manager,
    name,
    parent,
    state,
    status,
    client,
    createdBy: req?.user?.id,
    auditLogs: [
      {
        action: "create",
        performedBy: new mongoose.Types.ObjectId(req.user.id),
        timestamp: new Date(),
      },
    ],
  });

  // ✅ Single response only
  res
    .status(201)
    .json(new ApiResponse(201, godown, "Godown created successfully"));
});

exports.createBulkGodowns = asyncHandler(async (req, res) => {
  console.log("Processing godowns", req.body);
  const { godowns } = req.body;

  // Validate input
  if (!Array.isArray(godowns) || godowns.length === 0) {
    throw new ApiError(400, "Godowns array is required in body");
  }

  // Validate user
  const userId = req.user.id;
  const user = await User.findById(userId).lean();
  console.log(user, "user");
  if (!user) throw new ApiError(404, "User not found");
  const clientId = user.clientID;
  if (!clientId) throw new ApiError(400, "Client ID is required from token");

  // Preload company IDs
  const companies = await Company.find({}, "_id");
  const validCompanyIds = new Set(companies.map((c) => String(c._id)));

  // Preload existing godown codes
  const existingGodowns = await Godown.find({}, "code");
  const existingCodes = new Set(existingGodowns.map(godown => godown.code));

  const results = [];
  const errors = [];
  const seenCodes = new Set();

  // Process godowns
  for (const [index, body] of godowns.entries()) {
    try {
      // Required fields
      if (!body.name || !body.company) {
        throw new Error("name and company are required");
      }
      if (!validCompanyIds.has(String(body.company))) {
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
      const address = body.address || `Address ${index + 1}, ${body.city || 'Unknown'}`;
      const city = body.city || "Unknown";
      const contactNumber = body.contactNumber || `+919${(973884720 + index).toString().padStart(9, '0')}`;
      const country = body.country || "India";
      const state = body.state || "Unknown";
      const status = body.status || "Active";

      const godownObj = {
        _id: new mongoose.Types.ObjectId(), // Generate unique _id
        address,
        capacity: body.capacity || 0,
        city,
        code,
        company: body.company,
        contactNumber,
        country,
        isPrimary: body.isPrimary || false,
        manager: body.manager || "",
        name: body.name,
        parent: body.parent || null,
        state,
        status,
        client: clientId,
        createdBy: userId,
        auditLogs: [
          {
            action: "create",
            performedBy: new mongoose.Types.ObjectId(userId),
            timestamp: new Date(),
            details: "Bulk godown import",
          },
        ],
      };

      results.push(godownObj);
    } catch (err) {
      errors.push({
        index,
        name: body?.name,
        code: body?.code,
        error: err.message,
      });
    }
  }

  // Log prepared results
  console.log(`Prepared ${results.length} valid godowns for insertion`);

  // Batch insert
  const inserted = await insertInBatches(results, 1000);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        totalReceived: godowns.length,
        totalInserted: inserted.length,
        totalFailed: errors.length,
        insertedIds: inserted.map((g) => g._id),
        errors,
      },
      "Bulk godown import completed successfully"
    )
  );
});
exports.updateGodown = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) throw new ApiError(400, "Godown ID is required");

  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  const godown = await Godown.findById(id);
  if (!godown) throw new ApiError(404, "Godown not found");

  console.log("Godown before update:", godown);

  const allowedFields = [
    "address",
    "capacity",
    "city",
    "code",
    "company",
    "contactNumber",
    "country",
    "isPrimary",
    "manager",
    "name",
    "parent",
    "state",
    "status",
  ];

  const body = req.body || {}; // safeguard
  const updateData = {};
  Object.keys(body).forEach(key => {
    if (allowedFields.includes(key)) updateData[key] = body[key];
  });

  // Track changes for audit log
  const oldData = godown.toObject();
  const changes = {};
  Object.keys(updateData).forEach(key => {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(updateData[key])) {
      changes[key] = { from: oldData[key], to: updateData[key] };
    }
  });

  // Apply updates
  Object.assign(godown, updateData);
  console.log("Godown before save:", godown);

  // Audit log
  if (!godown.auditLogs) godown.auditLogs = [];
  godown.auditLogs.push({
    action: "update",
    performedBy: req.user.id,
    details: "Godown updated",
    changes,
    timestamp: new Date()
  });
  console.log("Godown after update:", godown);

  await godown.save();

  res.status(200).json(new ApiResponse(200, godown, "Godown updated successfully"));
});





// ✅ Get all godowns
exports.getGodowns = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    // const userId = "68c1503077fd742fa21575df"; // hardcoded for now

    const { search, status, sortBy, sortOrder, limit = 3, page = 1 } = req.query;

    const perPage = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);
    const skip = (currentPage - 1) * perPage;

    // sorting logic
    let sort = {};
    if (sortBy) {
      let field = sortBy === "name" ? "name" : "createdAt"; // tumhare godown schema ke fields
      let order = sortOrder === "desc" ? -1 : 1;
      sort[field] = order;
    } else {
      sort = { createdAt: -1 };
    }

    const result = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "godowns",
          localField: "clientID",
          foreignField: "client",
          as: "godowns",
        },
      },
      {
        $unwind: {
          path: "$godowns",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $replaceRoot: { newRoot: "$godowns" }, // sirf godown document ban gaya
      },
      {
        $match: {
          ...(status ? { status } : {}),
          ...(search
            ? {
                $or: [
                  { name: { $regex: search, $options: "i" } },
                  { location: { $regex: search, $options: "i" } },
                ],
              }
            : {}),
        },
      },
      {
        $sort: sort,
      },
      {
        $facet: {
          records: [
            { $skip: skip },
            { $limit: perPage },
          ],
          totalCount: [
            { $count: "count" },
          ],
        },
      },
    ]);

    const records = result?.[0]?.records || [];
    const total = result?.[0]?.totalCount?.[0]?.count || 0;

    res.status(200).json(
      new ApiResponse(
        200,
        {
          records,
          pagination: {
            total,
            page: currentPage,
            limit: perPage,
            totalPages: Math.ceil(total / perPage),
          },
        },
        records.length ? "Godowns fetched successfully" : "No godowns found"
      )
    );
  } catch (error) {
    throw new ApiError(500, error.message || "Internal server error");
  }
});


// ✅ Get godown by ID
exports.getGodownById = asyncHandler(async (req, res) => {
  const godown = await Godown.findById(req.params.id)
    .populate("company", "namePrint")
    .populate("client", "name email");

  if (!godown) throw new ApiError(404, "Godown not found");

  res.status(200).json(new ApiResponse(200, godown, "Godown fetched"));
});

// ✅ Get godowns by Company
exports.getGodownsByCompany = asyncHandler(async (req, res) => {
  console.log("gooodcom")
  try {
    const userId = req.user.id;
    // const userId = "68c1503077fd742fa21575df"; // hardcoded for now
 const { companyId } = req.params;
       if (!companyId) throw new ApiError(400, "Company ID is required");
    const { search, status, sortBy, sortOrder, limit = 3, page = 1 } = req.query;
       

    const perPage = parseInt(limit, 10);
    const currentPage = parseInt(page, 10);
    const skip = (currentPage - 1) * perPage;

    // sorting logic
    let sort = {};
    if (sortBy) {
      let field = sortBy === "name" ? "name" : "createdAt"; // tumhare godown schema ke fields
      let order = sortOrder === "desc" ? -1 : 1;
      sort[field] = order;
    } else {
      sort = { createdAt: -1 };
    }

    const result = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(userId),
          
        },
      },
      {
        $lookup: {
          from: "godowns",
          localField: "clientID",
          foreignField: "client",
          as: "godowns",
        },
      },
      {
        $unwind: {
          path: "$godowns",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $replaceRoot: { newRoot: "$godowns" }, // sirf godown document ban gaya
      },
      {
        $match: {
          ...(status ? { status } : {}),
          ...(search
            ? {
                $or: [
                  { name: { $regex: search, $options: "i" } },
                  { location: { $regex: search, $options: "i" } },
                ],
              }
            : {}),
          company:new mongoose.Types.ObjectId(companyId),
        },
      },
      {
        $sort: sort,
      },
      {
        $facet: {
          records: [
            { $skip: skip },
            { $limit: perPage },
          ],
          totalCount: [
            { $count: "count" },
          ],
        },
      },
    ]);

    const records = result?.[0]?.records || [];
    const total = result?.[0]?.totalCount?.[0]?.count || 0;

    res.status(200).json(
      new ApiResponse(
        200,
        {
          records,
          pagination: {
            total,
            page: currentPage,
            limit: perPage,
            totalPages: Math.ceil(total / perPage),
          },
        },
        records.length ? "Godowns fetched successfully" : "No godowns found"
      )
    );
  } catch (error) {
    throw new ApiError(500, error.message || "Internal server error");
  }
});


// // ✅ Update godown
// exports.updateGodown = asyncHandler(async (req, res) => {
//   const godown = await Godown.findByIdAndUpdate(req.params.id, req.body, {
//     new: true,
//   });

//   if (!godown) throw new ApiError(404, "Godown not found");

//   res.status(200).json(new ApiResponse(200, godown, "Godown updated"));
// });

// ✅ Delete godown
exports.deleteGodown = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ✅ 1️⃣ Logged-in user check
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  // ✅ 2️⃣ Ensure godown exists
  const godown = await Godown.findById(id);
  if (!godown) throw new ApiError(404, "Godown not found");

  // ✅ 3️⃣ Track changes for audit log
  const oldStatus = godown.status;
  godown.status = "Delete"; // Soft delete

  // ✅ 4️⃣ Push audit log
  if (!godown.auditLogs) godown.auditLogs = [];
  godown.auditLogs.push({
    action: "delete",
    performedBy: req.user.id,
    details: `Godown "${godown.name}" deleted`,
    changes: { status: { from: oldStatus, to: "Delete" } },
    timestamp: new Date(),
  });

  // ✅ 5️⃣ Save document
  const deletedGodown = await godown.save();

  // ✅ 6️⃣ Send response
  res
    .status(200)
    .json(new ApiResponse(200, deletedGodown, "Godown deleted successfully"));
});

