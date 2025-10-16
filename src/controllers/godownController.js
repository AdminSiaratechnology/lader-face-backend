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
    client
  });

  // ✅ Single response only
  res
    .status(201)
    .json(new ApiResponse(201, godown, "Godown created successfully"));
});
exports.updateGodown = asyncHandler(async (req, res) => {
  const { id } = req.params; // Godown ka id URL se aayega
  const updateData = req.body;

  // ✅ Logged-in user check
  const user = await User.findById(req.user.id).lean();
  if (!user) throw new ApiError(404, "User not found");

  // ✅ Ensure godown exists
  const godown = await Godown.findById(id);
  if (!godown) throw new ApiError(404, "Godown not found");

  // ✅ Update only allowed fields (security ke liye)
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

  const filteredData = {};
  Object.keys(updateData).forEach((key) => {
    if (allowedFields.includes(key)) {
      filteredData[key] = updateData[key];
    }
  });

  // ✅ Perform update
  const updatedGodown = await Godown.findByIdAndUpdate(
    id,
    { $set: filteredData },
    { new: true, runValidators: true }
  ).lean();

  res
    .status(200)
    .json(new ApiResponse(200, updatedGodown, "Godown updated successfully"));
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

  // ✅ Logged-in user check
  const user = await User.findById(req.user.id).lean();
  if (!user) throw new ApiError(404, "User not found");

  // ✅ Ensure godown exists
  const godown = await Godown.findById(id);
  if (!godown) throw new ApiError(404, "Godown not found");

  // ✅ Soft delete (update status only)
  const deletedGodown = await Godown.findByIdAndUpdate(
    id,
    { $set: { status: "Delete" } },
    { new: true }
  ).lean();

  res
    .status(200)
    .json(new ApiResponse(200, deletedGodown, "Godown deleted successfully"));
});

