const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const User = require("../models/User");
const mongoose = require("mongoose");
const ApiError = require("../utils/apiError");

exports.getAllClientUsersWithCompany = asyncHandler(async (req, res) => {
  const clientId = req.user.clientID; // Logged-in user's client ID
  const { companyId } = req.params;
  if (!companyId) throw new ApiError(400, "Company ID is required");
  const {
    search = "",
    role = "",
    status = "",
    sortBy = "name",
    sortOrder = "asc",
    page = 1,
    limit = 10,
  } = req.query;
  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;
  // ✅ Prepare match conditions
  const matchStage = {
    clientID: new mongoose.Types.ObjectId(clientId),
    company: new mongoose.Types.ObjectId(companyId),
    status: { $ne: "delete" }, // exclude deleted
  };
  if (status && status.trim() !== "") {
    matchStage.status = status;
  }
  if (role && role.trim() !== "") {
    matchStage.role = { $regex: role, $options: "i" };
  }
  if (search && search.trim() !== "") {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { contactNumber: { $regex: search, $options: "i" } },
    ];
  }
  // ✅ Sorting
  const sortField = sortBy === "name" ? "name" : "createdAt";
  const sortOrderValue = sortOrder === "desc" ? -1 : 1;
  // ✅ Aggregation without lookup (no duplicates)
  const result = await User.aggregate([
    { $match: matchStage },
    { $sort: { [sortField]: sortOrderValue } },

    // ✅ Lookup company names only
    {
      $lookup: {
        from: "companies",
        localField: "access.company",
        foreignField: "_id",
        as: "accessCompanies",
        pipeline: [
          { $project: { namePrint: 1 } }, // only fetch name
        ],
      },
    },

    // ✅ Merge only company name into access
    {
      $addFields: {
        access: {
          $map: {
            input: "$access",
            as: "acc",
            in: {
              $mergeObjects: [
                "$$acc",
                {
                  company: {
                    $arrayElemAt: [
                      {
                        $map: {
                          input: {
                            $filter: {
                              input: "$accessCompanies",
                              as: "acomp",
                              cond: { $eq: ["$$acomp._id", "$$acc.company"] },
                            },
                          },
                          as: "c",
                          in: { _id: "$$c._id", namePrint: "$$c.namePrint" },
                        },
                      },
                      0,
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    },

    { $project: { accessCompanies: 0 } },

    {
      $facet: {
        records: [{ $skip: skip }, { $limit: perPage }],
        totalCount: [{ $count: "count" }],
      },
    },
  ]);

  const users = result?.[0]?.records || [];
  const total = result?.[0]?.totalCount?.[0]?.count || 0;
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        users,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      users.length ? "Users fetched successfully" : "No users found"
    )
  );
});
exports.getAllClientUsers = asyncHandler(async (req, res) => {
  const clientId = req.user.clientID;
  const {
    search = "",
    role = "",
    status = "",
    sortBy = "name",
    sortOrder = "asc",
    page = 1,
    limit = 10,
  } = req.query;
  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;
  const sortField = sortBy === "name" ? "name" : "createdAt";
  const sortOrderValue = sortOrder === "desc" ? -1 : 1;

  const matchStage = {
    clientID: new mongoose.Types.ObjectId(clientId),
    status: { $ne: "delete" },
  };
  if (search) {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }
  if (role) matchStage.role = role;
  if (status) matchStage.status = status;

  const result = await User.aggregate(
    [
      { $match: matchStage },
      { $sort: { [sortField]: sortOrderValue } },
      {
        $lookup: {
          from: "companies",
          let: { companyIds: "$access.company" },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$companyIds"] } } },
            { $project: { namePrint: 1 } },
          ],
          as: "accessCompanies",
        },
      },
      {
        $addFields: {
          access: {
            $map: {
              input: "$access",
              as: "acc",
              in: {
                $mergeObjects: [
                  "$$acc",
                  {
                    company: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$accessCompanies",
                            as: "c",
                            cond: { $eq: ["$$c._id", "$$acc.company"] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },

      { $project: { accessCompanies: 0, auditLogs: 0, password: 0 } },
      {
        $facet: {
          records: [{ $skip: skip }, { $limit: perPage }],
          totalCount: [{ $count: "count" }],
        },
      },
    ],
    { maxTimeMS: 60000, allowDiskUse: true }
  );

  const users = result?.[0]?.records || [];
  const total = result?.[0]?.totalCount?.[0]?.count || 0;

  res.status(200).json(
    new ApiResponse(
      200,
      {
        users,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      users.length ? "Users fetched successfully" : "No users found"
    )
  );
});

exports.updateUserProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { name, phone, area, pincode, profilePicture } = req.body;
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  console.log(req.files, "req.files");

  user.name = name;
  user.phone = phone;
  user.area = area;
  user.pincode = pincode;
  const profileUrl =
    req.files && req.files["profile"] ? req.files["profile"][0].location : null;
  if (profileUrl) {
    user.profilePicture = profileUrl;
  }
  console.log(profileUrl, "profileUrl");
  console.log(req.files, "req.files");
  await user.save();
  const updatedUser = await User.findById(userId)
    .populate({
      path: "access.company",
      select: "namePrint logo nameStreet code",
    })
    .select("-password -__v");

  // Send consistent structure
  const safeUser = updatedUser.toObject();
  safeUser.access = [...(updatedUser.access || [])];
  res
    .status(200)
    .json(new ApiResponse(200, safeUser, "User profile updated successfully"));
});

exports.getPartners = asyncHandler(async (req, res) => {
  const {
    search = "",
    status = "",
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 10,
  } = req.query;

  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;
  const sortField = sortBy === "name" ? "name" : "createdAt";
  const sortOrderValue = sortOrder === "desc" ? -1 : 1;

  // Match filters
  const matchStage = { role: "Partner", status: {$ne : "delete"} }; // always restrict to partners

  if (search?.trim()) {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (status) matchStage.status = status;

  // Fetch paginated data
  const [partners, total] = await Promise.all([
    User.aggregate([
      { $match: matchStage },
      { $sort: { [sortField]: sortOrderValue } },
      { $skip: skip },
      { $limit: perPage },
      { $project: { password: 0, __v: 0 } },
    ]),
    User.countDocuments(matchStage),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        data: partners,
        pagination: {
          total,
          totalPages,
          currentPage,
          perPage,
        },
      },
      "Partners fetched successfully"
    )
  );
});
