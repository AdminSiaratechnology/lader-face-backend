const CustomerGroup = require("../models/CustomerGroup");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const ApiError = require("../utils/apiError");
const Counter = require("../models/Counter");
const { checkUnique } = require("../utils/checkUnique");

const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

exports.createGroup = asyncHandler(async (req, res) => {
  const { name, status = "active", companyId, parentGroup } = req.body;
  const clientId = req?.user?.clientID;

  if (!name?.trim()) throw new ApiError(400, "Group name is required");
  if (!companyId) throw new ApiError(400, "Company ID is required");
     await checkUnique({
    model: CustomerGroup,
    filter: { companyId, clientId, name:name.trim() },
    message: "Customer Group name already exists",
  });

  // Optional: Prevent circular reference
  if (parentGroup) {
    const parent = await CustomerGroup.findById(parentGroup);
    if (!parent || parent.companyId.toString() !== companyId) {
      throw new ApiError(400, "Invalid parent group");
    }
  }

  const group = await CustomerGroup.create({
    name: name.trim(),
    status,
    companyId,
    clientId: clientId,
    parentGroup: parentGroup || null,
  });

  res.status(201).json(new ApiResponse(201, group, "Customer group created"));
});

exports.bulkCreateCustomerGroups = async (req, res) => {
  try {
    const { groups, companyId } = req.body;
    const clientId = req.user.clientID;

    if (!Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ message: "Groups array required" });
    }

    const total = groups.length;

    // 🚀 STEP 1: Increment counter ONCE
    const counter = await Counter.findOneAndUpdate(
      {
        clientId,
        companyId,
        type: "customerGroup",
      },
      { $inc: { seq: total } },
      { new: true, upsert: true }
    );

    const startSeq = counter.seq - total + 1;

    // 🚀 STEP 2: Generate payload with code in memory
    const payload = groups.map((g, index) => ({
      clientId,
      companyId,
      name: g.name,
      parentGroup: g.parentGroup || null,
      code: (startSeq + index).toString().padStart(12, "0"),
    }));

    // 🚀 STEP 3: Bulk insert (FAST)
    const result = await CustomerGroup.insertMany(payload, {
      ordered: true,
    });

    res.status(201).json({
      success: true,
      count: result.length,
      message: "Customer groups created successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


exports.updateGroup = asyncHandler(async (req, res) => {
  const { name, status, parentGroup } = req.body;
  const clientId = req?.user?.clientID;
      const companyId=req?.body?.companyId


  const updateData = {
    ...(name && { name: name.trim() }),
    ...(status && { status }),
    ...(parentGroup !== undefined && {
      parentGroup: parentGroup || null ? null : parentGroup,
    }),
  };
       await checkUnique({
    model: CustomerGroup,
    filter: { companyId, clientId, name:name.trim() },
    excludeId: req.params.id,
    
    message: "Customer Group name already exists",
  });

  const group = await CustomerGroup.findOneAndUpdate(
    { _id: req.params.id, clientId: req.user.clientID, isDeleted: false },
    updateData,
    { new: true, runValidators: true }
  );

  if (!group) throw new ApiError(404, "Group not found");
  res.json(new ApiResponse(200, group, "Group updated"));
});

// controllers/customerGroupController.js
exports.getGroups = asyncHandler(async (req, res) => {
  const {
    companyId,
    search = "",
    status = "",
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 10,
  } = req.query;


  if (!companyId) throw new ApiError(400, "companyId is required");


  // Base filter (never changes)
  const baseFilter = {
    clientId: req.user.clientID,
    companyId,
    isDeleted: false,
  };

  // Filtered query (for list)
  const listFilter = {
    ...baseFilter,
    ...(search && {
      name: { $regex: escapeRegex(search), $options: "i" },
    }),
    ...(status && status !== "all" && { status }),
  };

  const skip = (Number(page) - 1) * Number(limit);

  const [groups, totalFiltered, globalCounts] = await Promise.all([
    CustomerGroup.find(listFilter)
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),

    CustomerGroup.countDocuments(listFilter),

    // This gives real totals (ignores search/status filter)
    Promise.all([
      CustomerGroup.countDocuments(baseFilter),
      CustomerGroup.countDocuments({ ...baseFilter, status: "active" }),
      CustomerGroup.countDocuments({ ...baseFilter, status: "inactive" }),
    ]),
  ]);

  const [totalAll, activeAll, inactiveAll] = globalCounts;

  res.json(
    new ApiResponse(200, {
      groups,
      total: totalFiltered,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalFiltered / Number(limit)),

      // These are REAL totals (never affected by search/filter)
      stats: {
        total: totalAll,
        active: activeAll,
        inactive: inactiveAll,
      },
    })
  );
});

exports.getGroupById = asyncHandler(async (req, res) => {
  const group = await CustomerGroup.findOne({
    _id: req.params.id,
    clientId: req.user.clientID,
    isDeleted: false,
  });
  

  if (!group) throw new ApiError(404, "Group not found");
  res.json(new ApiResponse(200, group));
});

exports.deleteGroup = asyncHandler(async (req, res) => {


  
  const group = await CustomerGroup.findOneAndUpdate(
    { _id: req.params.id, clientId: req.user.clientID, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );


  if (!group) throw new ApiError(404, "Group not found");

  res.json(new ApiResponse(200, null, "Group deleted successfully"));
});
