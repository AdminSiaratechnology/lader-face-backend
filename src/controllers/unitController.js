const Unit = require('../models/Unit');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const User = require('../models/User');

// ✅ Create Unit
exports.createUnit = asyncHandler(async (req, res) => {
    // res.status(200).json({ message: "Create Unit - Not Implemented" });
    const agentId=req.user.id;
  const {  companyId, name, type, symbol, decimalPlaces, firstUnit, conversion, secondUnit,UQC } = req.body;

  if ( !companyId || !name || !type) {
    throw new ApiError(400, "clientId, companyId, name and type are required");

  }
  

 

  // Sirf clientAgent field hi le aayenge
  const agentDetail = await User.findById(agentId, { clientAgent: 1 });

  if (!agentDetail || !agentDetail.clientAgent) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  const clientId = agentDetail.clientAgent;

  const unit = await Unit.create({
    clientId, companyId, name, type,
    symbol, decimalPlaces,
    firstUnit, conversion, secondUnit,UQC
  });

  res.status(201).json(new ApiResponse(201, unit, "Unit created successfully"));
});

// ✅ Update Unit
exports.updateUnit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const unit = await Unit.findByIdAndUpdate(id, updateData, { new: true });
  if (!unit) throw new ApiError(404, "Unit not found");

  res.status(200).json(new ApiResponse(200, unit, "Unit updated successfully"));
});

// ✅ Delete Unit
exports.deleteUnit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const unit = await Unit.findByIdAndDelete(id);

  if (!unit) throw new ApiError(404, "Unit not found");

  res.status(200).json(new ApiResponse(200, null, "Unit deleted successfully"));
});

// ✅ Get Units (by client & company)
exports.getUnits = asyncHandler(async (req, res) => {
  const { companyId, search, status, sortBy, sortOrder, limit = 10, page = 1 } = req.query;

  const userId = req.user.id;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  let clientId = user.clientAgent;

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

