const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.getAllClientUsersWithCompany = asyncHandler(async (req, res) => {
  let clientId = req.user.id; // Logged in user ID
  const result = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(clientId)
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: 'clientID',
        as: 'users'
      }
    },
    {
      $lookup: {
        from: 'companies',
        localField: 'clientID',
        foreignField: 'client',
        as: 'companies'
      }
    },
    {
      $project: { password: 0 }
    }
    
  ], {
    maxTimeMS: 60000,
    allowDiskUse: true
  });

  res.status(200).json(new ApiResponse(200, result, "Fetched successfully"));
});
exports.getAllClientUsers = asyncHandler(async (req, res) => {
  const clientId = req.user.id; // Logged in user ID
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

  // aggregation
  const result = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(clientId) } },
    {
      $lookup: {
        from: "users",
        localField: "clientID",
        foreignField: "clientID",
        as: "users",
        pipeline: [
          { $match: { status: { $ne: "delete" } } }, // remove deleted users
          ...(status && status.trim() !== "" ? [{ $match: { status } }] : []),
          ...(role && role.trim() !== "" ? [{ $match: { role: { $regex: role, $options: "i" } } }] : []),
          ...(search && search.trim() !== ""
            ? [
                {
                  $match: {
                    $or: [
                      { name: { $regex: search, $options: "i" } },
                      { email: { $regex: search, $options: "i" } },
                      { contactNumber: { $regex: search, $options: "i" } },
                    ],
                  },
                },
              ]
            : []),
          {
            $sort: (() => {
              const field = sortBy === "name" ? "name" : "createdAt";
              const order = sortOrder === "desc" ? -1 : 1;
              return { [field]: order };
            })(),
          },
        ],
      },
    },
    { $unwind: { path: "$users", preserveNullAndEmptyArrays: false } },
    { $replaceRoot: { newRoot: "$users" } },
    {
      $facet: {
        records: [{ $skip: skip }, { $limit: perPage }],
        totalCount: [{ $count: "count" }],
      },
    },
  ], { maxTimeMS: 60000, allowDiskUse: true });

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


