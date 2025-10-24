const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const User = require('../models/User');
const mongoose = require('mongoose');
const ApiError = require('../utils/apiError');

exports.getAllClientUsersWithCompany = asyncHandler(async (req, res) => {
  console.log(req.user)
  const clientId = req.user.clientID; // Logged in user ID
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
  if(!companyId) throw new ApiError(400,"company id is require")

  // aggregation
  const result = await User.aggregate([
    { $match: { clientID: new mongoose.Types.ObjectId(clientId),company:new mongoose.Types.ObjectId(companyId) } },
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
    { $match: { clientId: new mongoose.Types.ObjectId(clientId) } },
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


