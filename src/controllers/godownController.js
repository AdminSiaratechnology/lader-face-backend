const Godown = require("../models/Godown");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const ApiError = require("../utils/apiError");
const { default: mongoose } = require("mongoose");
const User = require("../models/User");
const { generateUniqueId } = require("../utils/generate16DigiId");

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
  const { companyId } = req.params;

  const godowns = await Godown.find({ company: companyId }).populate(
    "company",
    "namePrint"
  );

  res.status(200).json(new ApiResponse(200, godowns, "Godowns fetched"));
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

