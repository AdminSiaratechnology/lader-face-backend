const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const User = require("../models/User");
const mongoose = require("mongoose");
const ApiError = require("../utils/apiError");
const sendEmail = require("../utils/sendEmail");

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
// 🔥 Extra Count Aggregation (Role Counts + Active Count)
const countStats = await User.aggregate([
  {
    $match: {
      clientID: new mongoose.Types.ObjectId(clientId),
      status: { $ne: "delete" }
    }
  },
  {
    $group: {
      _id: null,
      adminCount: {
        $sum: { $cond: [{ $eq: ["$role", "Admin"] }, 1, 0] }
      },
      salesmanCount: {
        $sum: { $cond: [{ $eq: ["$role", "Salesman"] }, 1, 0] }
      },
      customerCount: {
        $sum: { $cond: [{ $eq: ["$role", "Customer"] }, 1, 0] }
      },
      activeUsers: {
        $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] }
      }
    }
  }
]);

  const users = result?.[0]?.records || [];
  const total = result?.[0]?.totalCount?.[0]?.count || 0;
const stats = countStats?.[0] || {
  adminCount: 0,
  salesmanCount: 0,
  customerCount: 0,
  activeUsers: 0
};

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
        counts: {
          adminCount: stats.adminCount,
          salesmanCount: stats.salesmanCount,
          customerCount: stats.customerCount,
          activeUsers: stats.activeUsers
        }
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
  const matchStage = { role: "Partner", status: { $ne: "delete" } };

  if (search?.trim()) {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { code: {$regex: search, $options: "i" }}
    ];
  }

  if (status) matchStage.status = status;

  // Fetch paginated data + counts
  const [partners, total] = await Promise.all([
    User.aggregate([
      { $match: matchStage },
      { $sort: { [sortField]: sortOrderValue } },
      { $skip: skip },
      { $limit: perPage },

      // 1️⃣ GET ALL CLIENTS CREATED BY THIS PARTNER
      {
        $lookup: {
          from: "users",
          let: { partnerId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$parent", "$$partnerId"] },
                role: "Client",
                status: { $ne: "delete" },
              },
            },
          ],
          as: "clientsList",
        },
      },

      // 2️⃣ COUNT CLIENTS
      {
        $addFields: {
          totalClients: { $size: "$clientsList" },
        },
      },

      // 3️⃣ GET ALL USERS OF THESE CLIENTS
      {
        $lookup: {
          from: "users",
          let: { clientIds: "$clientsList._id" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$clientID", "$$clientIds"] },
                status: { $ne: "delete" },
              },
            },
          ],
          as: "clientUsers",
        },
      },

      // 4️⃣ COUNT ALL USERS UNDER THOSE CLIENTS
      {
        $addFields: {
          totalUsers: { $size: "$clientUsers" },
        },
      },

      // 5️⃣ CLEAN OUTPUT
      {
        $project: {
          password: 0,
          __v: 0,
          clientsList: 0,
          clientUsers: 0,
        },
      },
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

exports.getClients = asyncHandler(async (req, res) => {
  const {
    search = "",
    status = "",
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 10,
    partnerId = "",
  } = req.query;
  const userId = req.user.id;
  const user = await User.findById(userId);
  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;
  const sortField = sortBy === "name" ? "name" : "createdAt";
  const sortOrderValue = sortOrder === "desc" ? -1 : 1;

  // Match filters
  const matchStage = { role: "Client", status: { $ne: "delete" } };

  if (user.role === "Partner") {
    console.log(userId);
    matchStage.parent = new mongoose.Types.ObjectId(userId);
  }
  if (search?.trim()) {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { code: {$regex: search, $options: "i" }}
    ];
  }
  console.log(matchStage);
  // Partner-based restriction
  if (user.role === "Partner") {
    // Partner should only access their own clients
    matchStage.parent = new mongoose.Types.ObjectId(userId);
  } else {
    // Admin / SuperAdmin can filter by partner
    if (partnerId) {
      matchStage.parent = new mongoose.Types.ObjectId(partnerId);
    }
  }

  if (status) matchStage.status = status;
  console.log(sortOrderValue);
  // Fetch paginated data
  const [clients, total] = await Promise.all([
    User.aggregate([
      { $match: matchStage },
      { $sort: { [sortField]: sortOrderValue } },
      { $skip: skip },
      { $limit: perPage },

      // 🔍 Count users belonging to this client
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "clientID",
          as: "clientUsers",
        },
      },
      {
        $addFields: {
          totalClientUsers: { $size: "$clientUsers" },
        },
      },
      {
        $project: {
          password: 0,
          __v: 0,
          clientUsers: 0,
        },
      },
    ]),

    User.countDocuments(matchStage),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        data: clients,
        pagination: {
          total,
          totalPages,
          currentPage,
          perPage,
        },
      },
      "Clients fetched successfully"
    )
  );
});

exports.sendEmail = asyncHandler(async (req, res) => {
  try {
    const { requestedLimit, reason, toEmail, fromEmail, userId, name, role } =
      req.body;

    if (!requestedLimit) {
      return res.status(400).json({
        success: false,
        message: "Requested limit required.",
      });
    }
    const supportingDocuments = req.files?.map((file) => file.location) || [];

    const subject = `New Limit Request from ${name || fromEmail}`;
    const html = `
      <h3>New Limit Request</h3>
      <p><strong>User ID:</strong> ${userId}</p>
      <p><strong>User Name:</strong> ${name}</p>
      <p><strong>Requested Limit:</strong> ${requestedLimit}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Role:</strong>${role}</p>
      <hr/>
      <p>Submitted at: ${new Date().toLocaleString()}</p>
    `;

    // ✅ Send via Zoho
    const result = await sendEmail({
      to: toEmail,
      from: process.env.ZOHO_USER, // always a verified sender
      subject,
      html,
      attachments: req.files.map((file) => ({
        filename: file.originalname,
        path: file.location, // ✅ directly attach from S3
      })),
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send email",
        error: result.error,
      });
    }

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
      messageId: result.messageId,
    });
  } catch (err) {
    console.error("❌ Email send API error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

exports.getSubRoleUsers = asyncHandler(async (req, res) => {
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

  // ✅ Match filters
  const matchStage = {
    role: "SuperAdmin",
    status: { $ne: "delete" },
    allPermissions: true,
  };

  if (search?.trim()) {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { code: {$regex: search, $options: "i" }}
    ];
  }

  if (status) matchStage.status = status;

  // ✅ Fetch paginated data
  const [insideUsers, total] = await Promise.all([
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
        data: insideUsers,
        pagination: {
          total,
          totalPages,
          currentPage,
          perPage,
        },
      },
      "Sub-role Admin Users fetched successfully"
    )
  );
});
exports.requestLimit = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;

    // Logged-in user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Always request to parent
    const requestedToId = user.parent;
    if (!requestedToId) {
      return res.status(400).json({
        success: false,
        message: "Parent (requestedTo) not found for this user.",
      });
    }

    const { requestedLimit, reason, name, role } = req.body;

    if (!requestedLimit) {
      return res.status(400).json({
        success: false,
        message: "Requested limit is required.",
      });
    }

    // Uploaded documents from S3
    const supportingDocuments = req.files?.map((file) => file.location) || [];

    // Parent user (email receiver)
    const requestedToUser = await User.findById(requestedToId);
    if (!requestedToUser) {
      return res.status(404).json({
        success: false,
        message: "RequestedTo user not found",
      });
    }

    const toEmail = requestedToUser.email;

    // 1️⃣ Save Request on User
    user.requestedLimit = requestedLimit;

    user.limitHistory.push({
      performedBy: userId,
      previousLimit: user.limit,
      requestedLimit: requestedLimit,
      requestedTo: requestedToId,
      action: "requested",
      reason: reason || "",
      remarks: "",
      documents: supportingDocuments, // ⬅️ STORE DOCUMENTS HERE
      timestamp: new Date(),
    });

    await user.save();

    // 2️⃣ Prepare Email
    const subject = `New Limit Request from ${user.name}`;
    const html = `
      <h3>New Limit Request</h3>
      <p><strong>User ID:</strong> ${userId}</p>
      <p><strong>User Name:</strong> ${user.name}</p>
      <p><strong>Requested Limit:</strong> ${requestedLimit}</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Role:</strong> ${role}</p>
      <p><strong>Requested To:</strong> ${requestedToUser.name}</p>
      <hr/>
      <p>Submitted At: ${new Date().toLocaleString()}</p>
    `;

    const result = await sendEmail({
      to: toEmail,
      from: process.env.ZOHO_USER,
      subject,
      html,
      attachments: req.files?.map((file) => ({
        filename: file.originalname,
        path: file.location,
      })),
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: "Limit request saved but email failed",
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Limit request submitted successfully",
      requestedTo: requestedToId,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error("❌ Limit Request Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

exports.approveLimitRequest = asyncHandler(async (req, res) => {
  try {
    const approverId = req.user.id;
    const { userId } = req.params;
    const { approvedLimit, comment } = req.body;
const approver = await User.findById(approverId);
    if (!approvedLimit) {
      return res.status(400).json({
        success: false,
        message: "Approved limit is required.",
      });
    }

    const user = await User.findById(userId).populate("parent");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    // Update actual limit
    const previousLimit = user.limit;
    user.limit = approvedLimit + previousLimit;

    // Store approval entry
    user.limitHistory.push({
      previousLimit,
      newLimit: user.limit,
      approvedLimit: approvedLimit,
      action: "approved",
      remarks: comment || "",
      timestamp: new Date(),
      performedBy: approverId,
    });

    // Clear request values
    user.requestedLimit = null;
    user.requestedDocuments = [];

    await user.save();

    // Send email to user
    await sendEmail({
      to: user.email,
      from: process.env.ZOHO_USER,
      subject: "Your Limit Request Has Been Approved",
      html: `
        <h3>Limit Approved</h3>
        <p>Your limit request has been <strong>approved</strong>.</p>
        <p><strong>Old Limit:</strong> ${previousLimit}</p>
        <p><strong>Approved Limit:</strong> ${approvedLimit}</p>
        <p><strong>Approved By:</strong> ${approver.email}</p>
        <p><strong>Comment:</strong> ${comment || "None"}</p>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "Limit approved successfully.",
    });
  } catch (err) {
    console.error("❌ Approve Error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

exports.rejectLimit = asyncHandler(async (req, res) => {
  const adminId = req.user.id;
  const { userId, remark } = req.body;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const previousLimit = user.limit;

  // Add to history
  user.limitHistory.push({
    assignedBy: adminId,
    previousLimit,
    newLimit: user.limit,
    action: "rejected",
    remark,
  });

  // reset requested limit
  user.requestedLimit = 0;

  await user.save();

  res.status(200).json({
    success: true,
    message: "Limit rejected",
    data: {
      previousLimit,
      newLimit: user.limit,
    },
  });
});

exports.getPendingLimitRequests = asyncHandler(async (req, res) => {
  try {
    const adminId = req.user.id;

    // Find all users who requested limit TO this admin
    const requests = await User.find({
      limitHistory: {
        $elemMatch: {
          action: "requested",
          requestedTo: adminId,
        },
      },
    }).select("name limit limitHistory email");

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (err) {
    console.error("Fetch Assigned Requests Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});

exports.getAllPartners = asyncHandler(async (req, res) => {
  const search = req.query.search || "";

  const matchStage = {
    role: "Partner",
    status: { $ne: "delete" },
  };

  if (search.trim()) {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } }
    ];
  }

  const partners = await User.find(matchStage)
    .select("name email _id code status createdAt");

  return res.status(200).json(
    new ApiResponse(
      200,
      partners,
      "All Partners fetched successfully"
    )
  );
});

exports.getSubPartners = asyncHandler(async (req, res) => {
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
  const matchStage = { role: "SubPartner", status: { $ne: "delete" } };

  if (search?.trim()) {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { code: {$regex: search, $options: "i" }}
    ];
  }

  if (status) matchStage.status = status;

  // Fetch paginated data + counts
  const [partners, total] = await Promise.all([
    User.aggregate([
      { $match: matchStage },
      { $sort: { [sortField]: sortOrderValue } },
      { $skip: skip },
      { $limit: perPage },

      // 1️⃣ GET ALL CLIENTS CREATED BY THIS PARTNER
      {
        $lookup: {
          from: "users",
          let: { subPartnerId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$parent", "$$subPartnerId"] },
                role: "Client",
                status: { $ne: "delete" },
              },
            },
          ],
          as: "clientsList",
        },
      },

      // 2️⃣ COUNT CLIENTS
      {
        $addFields: {
          totalClients: { $size: "$clientsList" },
        },
      },

      // 3️⃣ GET ALL USERS OF THESE CLIENTS
      {
        $lookup: {
          from: "users",
          let: { clientIds: "$clientsList._id" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$clientID", "$$clientIds"] },
                status: { $ne: "delete" },
              },
            },
          ],
          as: "clientUsers",
        },
      },

      // 4️⃣ COUNT ALL USERS UNDER THOSE CLIENTS
      {
        $addFields: {
          totalUsers: { $size: "$clientUsers" },
        },
      },

      // 5️⃣ CLEAN OUTPUT
      {
        $project: {
          password: 0,
          __v: 0,
          clientsList: 0,
          clientUsers: 0,
        },
      },
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
      "Sub Partners fetched successfully"
    )
  );
});