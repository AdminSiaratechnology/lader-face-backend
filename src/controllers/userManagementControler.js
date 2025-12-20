const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const User = require("../models/User");
const mongoose = require("mongoose");
const ApiError = require("../utils/apiError");
const sendEmail = require("../utils/sendEmail");
const buildDateRange = require("../utils/dateFilter");
const ExcelJS = require("exceljs");
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
        status: { $ne: "delete" },
      },
    },
    {
      $group: {
        _id: null,
        adminCount: {
          $sum: { $cond: [{ $eq: ["$role", "Admin"] }, 1, 0] },
        },
        salesmanCount: {
          $sum: { $cond: [{ $eq: ["$role", "Salesman"] }, 1, 0] },
        },
        customerCount: {
          $sum: { $cond: [{ $eq: ["$role", "Customer"] }, 1, 0] },
        },
        activeUsers: {
          $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
        },
      },
    },
  ]);

  const users = result?.[0]?.records || [];
  const total = result?.[0]?.totalCount?.[0]?.count || 0;
  const stats = countStats?.[0] || {
    adminCount: 0,
    salesmanCount: 0,
    customerCount: 0,
    activeUsers: 0,
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
          activeUsers: stats.activeUsers,
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
  const matchStage = { role: "Partner", status: { $ne: "delete" } };

  if (search?.trim()) {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
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
    subPartnerId = "",
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
  if (user.role === "SubPartner") {
    console.log(userId);
    matchStage.parent = new mongoose.Types.ObjectId(userId);
  }
  if (search?.trim()) {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
    ];
  }
  console.log(matchStage);
  // Partner-based restriction
  if (user.role === "Partner") {
    // Partner should only access their own clients
    matchStage.parent = new mongoose.Types.ObjectId(userId);
  } else if (user.role === "SubPartner") {
    // SubPartner should only access their own clients
    matchStage.parent = new mongoose.Types.ObjectId(userId);
  } else {
    // Admin / SuperAdmin can filter by partner
    if (partnerId) {
      matchStage.parent = new mongoose.Types.ObjectId(partnerId);
    }
    if (subPartnerId) {
      matchStage.parent = new mongoose.Types.ObjectId(subPartnerId);
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
      // 🔍 Get createdBy user role
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdByUser",
          pipeline: [
            {
              $project: {
                role: 1,
                limit: 1,
                _id: 0,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          createdByRole: {
            $arrayElemAt: ["$createdByUser.role", 0],
          },
          createdByLimit: {
            $arrayElemAt: ["$createdByUser.limit", 0],
          },
        },
      },
      {
        $project: {
          password: 0,
          __v: 0,
          clientUsers: 0,
          createdByUser: 0,
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
      { code: { $regex: search, $options: "i" } },
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

    // if (!result.success) {
    //   return res.status(500).json({
    //     success: false,
    //     message: "Limit request saved but email failed",
    //     error: result.error,
    //   });
    // }

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
    const userId = req.user.id;
    const role = req.user.role;

    let matchFilter = {
      limitHistory: {
        $elemMatch: { action: "requested" },
      },
    };

    // Non-SuperAdmins see only their assigned requests
    if (role !== "SuperAdmin") {
      matchFilter.limitHistory.$elemMatch.requestedTo = userId;
    }

    let requests = await User.find(matchFilter).select(
      "name limit limitHistory email role"
    );

    // Build the final list with canApprove
    const finalRequests = await Promise.all(
      requests.map(async (user) => {
        // get last request entry
        const lastRequest = user.limitHistory
          .filter((h) => h.action === "requested")
          .pop();

        let canApprove = false;
        let requestedToRole = null;

        if (lastRequest) {
          // fetch assigned user's role
          const targetUser = await User.findById(
            lastRequest.requestedTo
          ).select("role");
          requestedToRole = targetUser?.role || null;

          // Approval rules:
          if (role === "SuperAdmin") {
            // super admin can approve ONLY if request is targeted to super admin
            if (requestedToRole === "SuperAdmin") {
              canApprove = true;
            }
          } else {
            // partners/subpartners/clients
            if (
              String(lastRequest.requestedTo) === String(userId) &&
              requestedToRole === role
            ) {
              canApprove = true;
            }
          }
        }

        return {
          ...user.toObject(),
          requestedToRole,
          canApprove,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: finalRequests.length,
      requests: finalRequests,
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
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const partners = await User.find(matchStage).select(
    "name email _id code status createdAt"
  );

  return res
    .status(200)
    .json(new ApiResponse(200, partners, "All Partners fetched successfully"));
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
  const partnerId = req.user.id;
  console.log(partnerId);
  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;
  const sortField = sortBy === "name" ? "name" : "createdAt";
  const sortOrderValue = sortOrder === "desc" ? -1 : 1;

  // Match filters
  const matchStage = { role: "SubPartner", status: { $ne: "delete" } };
  matchStage.parent = new mongoose.Types.ObjectId(partnerId);
  if (search?.trim()) {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
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

exports.getDashboardStatsSuperAdmin = async (req, res) => {
  try {
    const user = req.user; // middleware se mila

    // SuperAdmin Stats
    if (user.role === "SuperAdmin") {
      const totalPartners = await User.countDocuments({ role: "Partner" });
      const totalClients = await User.countDocuments({ role: "Client" });
      const totalUsers = await User.countDocuments({});

      return res.json({
        success: true,
        stats: {
          totalPartners,
          totalClients,
          totalUsers,
        },
      });
    }

    // Partner Stats
    if (user.role === "Partner") {
      const totalClients = await User.countDocuments({
        parent: user.id,
        role: "Client",
      });
      const totalUsers = await User.countDocuments({
        parent: user.id,
        role: "Client",
      });
      const totalSubPartners = await User.countDocuments({
        parent: user.id,
        role: "SubPartner",
      });
      return res.json({
        success: true,
        stats: {
          totalClients,
          totalUsers,
          totalSubPartners,
          limit: user.limit || 0,
        },
      });
    }

    return res.json({ success: true, stats: {} });
  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getUsersByLocation = async (req, res) => {
  try {
    const { state, city, area, region, status = "active" } = req.query;

    const match = { status };

    if (state) match.state = state;
    if (city) match.city = city;
    if (area) match.area = area;
    if (region) match.region = region;

    // 🔐 Role-based visibility
    let allowedRoles = [];

    if (req.user.role === "SuperAdmin") {
      allowedRoles = ["Client", "Partner"];
    }

    if (req.user.role === "Partner") {
      allowedRoles = ["Client", "SubPartner"];
      match.parent = new mongoose.Types.ObjectId(req.user.id);
    }
    if (req.user.role === "SubPartner") {
      allowedRoles = ["Client"];
      match.parent = new mongoose.Types.ObjectId(req.user.id);
    }

    match.role = { $in: allowedRoles };

    const data = await User.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            role: "$role",
            state: "$state",
            city: "$city",
            area: "$area",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.role": 1,
          "_id.state": 1,
          "_id.city": 1,
          "_id.area": 1,
        },
      },
    ]);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users by location",
    });
  }
};

//
//   try {
//     const { clientID, role } = req.user;
//     const { fromDate, toDate } = req.query;

//     // 🔢 Pagination for all tables - DIFFERENT LIMITS FOR EACH TABLE
//     const expiredPage = Number(req.query.expiredPage) || 1;
//     const expiredLimit = Number(req.query.expiredLimit) || 7;
//     const expiringPage = Number(req.query.expiringPage) || 1;
//     const expiringLimit = Number(req.query.expiringLimit) || 7;
//     const convertedPage = Number(req.query.convertedPage) || 1;
//     const convertedLimit = Number(req.query.convertedLimit) || 7;

//     const expiredSkip = (expiredPage - 1) * expiredLimit;
//     const expiringSkip = (expiringPage - 1) * expiringLimit;
//     const convertedSkip = (convertedPage - 1) * convertedLimit;

//     // 🔐 Role based base query
//     let baseQuery = {};
//     if (role === "SuperAdmin") baseQuery = {};
//     else if (role === "Partner" || role === "SubPartner")
//       baseQuery = { parent: clientID };
//     else if (role === "Admin" || role === "Client")
//       baseQuery = { clientID };
//     else
//       return res.status(403).json({ success: false, message: "Unauthorized" });

//     const now = new Date();

//     const demoExpiryFilter = buildDateRange("demoExpiry", fromDate, toDate);
//     const convertedDateFilter = buildDateRange(
//       "demoHistory.timestamp",
//       fromDate,
//       toDate
//     );

//     // 1️⃣ Expired demos (WITH PAGINATION)
//     const [expiredDemoClients, totalExpiredCount] = await Promise.all([
//       User.find({
//         ...baseQuery,
//         role: "Client",
//         isDemo: true,
//         demoExpiry: { $lt: now },
//         ...demoExpiryFilter,
//         status: { $nin: ["delete"] },
//       })
//         .select("name email demoExpiry demoPeriod createdAt")
//         .sort({ demoExpiry: -1 })
//         .skip(expiredSkip)
//         .limit(expiredLimit)
//         .lean(),

//       User.countDocuments({
//         ...baseQuery,
//         role: "Client",
//         isDemo: true,
//         demoExpiry: { $lt: now },
//         ...demoExpiryFilter,
//         status: { $nin: ["delete"] },
//       }),
//     ]);

//     // 2️⃣ Active demos (no pagination, optional for summary)
//     const activeDemoClients = await User.find({
//       ...baseQuery,
//       role: "Client",
//       isDemo: true,
//       demoExpiry: { $gte: now },
//       status: { $nin: ["delete"] },
//     })
//       .select("name email demoExpiry demoPeriod createdAt")
//       .lean();

//     // 3️⃣ Converted demos (WITH PAGINATION)
//     const [convertedClients, totalConvertedCount] = await Promise.all([
//       User.find({
//         ...baseQuery,
//         role: "Client",
//         isDemo: false,
//         "demoHistory.action": "converted",
//         ...convertedDateFilter,
//         status: { $nin: ["delete"] },
//       })
//         .select("name email createdAt demoHistory")
//         .sort({ createdAt: -1 })
//         .skip(convertedSkip)
//         .limit(convertedLimit)
//         .lean(),

//       User.countDocuments({
//         ...baseQuery,
//         role: "Client",
//         isDemo: false,
//         "demoHistory.action": "converted",
//         ...convertedDateFilter,
//         status: { $nin: ["delete"] },
//       }),
//     ]);

//     // ⏳ Expiring soon (next 7 days WITH PAGINATION)
//     const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

//     const [expiringSoonClients, totalExpiringCount] = await Promise.all([
//       User.find({
//         ...baseQuery,
//         role: "Client",
//         isDemo: true,
//         demoExpiry: { $gte: now, $lte: sevenDays },
//         status: { $nin: ["delete"] },
//       })
//         .select("name email demoExpiry")
//         .sort({ demoExpiry: 1 })
//         .skip(expiringSkip)
//         .limit(expiringLimit)
//         .lean(),

//       User.countDocuments({
//         ...baseQuery,
//         role: "Client",
//         isDemo: true,
//         demoExpiry: { $gte: now, $lte: sevenDays },
//         status: { $nin: ["delete"] },
//       }),
//     ]);

//     // 📊 Timeline (last 30 days default)
//     const timelineFrom =
//       fromDate || toDate
//         ? new Date(fromDate)
//         : new Date(new Date().setDate(new Date().getDate() - 30));

//     const expiredTimeline = await User.aggregate([
//       {
//         $match: {
//           ...baseQuery,
//           role: "Client",
//           isDemo: true,
//           demoExpiry: { $gte: timelineFrom, $lt: now },
//           status: { $nin: ["delete"] },
//         },
//       },
//       {
//         $project: {
//           date: { $dateToString: { format: "%Y-%m-%d", date: "$demoExpiry" } },
//         },
//       },
//       { $group: { _id: "$date", count: { $sum: 1 } } },
//       { $sort: { _id: 1 } },
//     ]);

//     const convertedTimeline = await User.aggregate([
//       {
//         $match: {
//           ...baseQuery,
//           role: "Client",
//           isDemo: false,
//           "demoHistory.action": "converted",
//           status: { $nin: ["delete"] },
//         },
//       },
//       { $unwind: "$demoHistory" },
//       {
//         $match: {
//           "demoHistory.action": "converted",
//           ...buildDateRange("demoHistory.timestamp", fromDate, toDate),
//         },
//       },
//       {
//         $project: {
//           date: {
//             $dateToString: { format: "%Y-%m-%d", date: "$demoHistory.timestamp" },
//           },
//         },
//       },
//       { $group: { _id: "$date", count: { $sum: 1 } } },
//       { $sort: { _id: 1 } },
//     ]);

//     // 📈 Summary
//     const totalExpired = totalExpiredCount;
//     const totalActive = activeDemoClients.length;
//     const totalConverted = totalConvertedCount;

//     const totalDemo = totalExpired + totalActive + totalConverted;
//     const conversionRate =
//       totalDemo > 0 ? ((totalConverted / totalDemo) * 100).toFixed(2) : 0;

//     return res.json({
//       success: true,
//       data: {
//         summary: {
//           totalExpired,
//           totalActive,
//           totalConverted,
//           conversionRate: Number(conversionRate),
//         },
//         charts: {
//           expiredTimeline: expiredTimeline.map((i) => ({ date: i._id, count: i.count })),
//           convertedTimeline: convertedTimeline.map((i) => ({ date: i._id, count: i.count })),
//         },
//         expiredDemoClients,
//         expiringSoonClients,
//         convertedClients,
//         pagination: {
//           expired: {
//             page: expiredPage,
//             limit: expiredLimit,  // ✅ Use separate limit
//             totalRecords: totalExpiredCount,
//             totalPages: Math.ceil(totalExpiredCount / expiredLimit), // ✅ Correct calculation
//           },
//           expiring: {
//             page: expiringPage,
//             limit: expiringLimit,  // ✅ Use separate limit
//             totalRecords: totalExpiringCount,
//             totalPages: Math.ceil(totalExpiringCount / expiringLimit), // ✅ Correct calculation
//           },
//           converted: {
//             page: convertedPage,
//             limit: convertedLimit,  // ✅ Use separate limit
//             totalRecords: totalConvertedCount,
//             totalPages: Math.ceil(totalConvertedCount / convertedLimit), // ✅ Correct calculation
//           },
//         },
//       },
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: "Demo analytics failed" });
//   }
// };

exports.getDemoClientDetails = async (req, res) => {
  try {
    const { clientID, role } = req.user;
    const { userId } = req.params;

    // Build authorization query
    let authQuery = { _id: userId };

    if (role === "Partner" || role === "SubPartner") {
      authQuery.parent = clientID;
    } else if (role === "Admin" || role === "Client") {
      authQuery.clientID = clientID;
    } else if (role !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const client = await User.findOne(authQuery)
      .select(
        "name email role isDemo demoExpiry demoPeriod demoHistory createdAt status documents"
      )
      .lean();

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Calculate additional metrics
    const now = new Date();
    let additionalInfo = {};

    if (client.isDemo) {
      const daysRemaining = Math.ceil(
        (new Date(client.demoExpiry) - now) / (1000 * 60 * 60 * 24)
      );
      additionalInfo = {
        daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
        isExpired: daysRemaining <= 0,
        expiryStatus:
          daysRemaining > 7
            ? "active"
            : daysRemaining > 0
            ? "expiring-soon"
            : "expired",
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        ...client,
        ...additionalInfo,
      },
    });
  } catch (error) {
    console.error("Error in getDemoClientDetails:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch demo client details",
      error: error.message,
    });
  }
};

exports.getDemoAnalytics = async (req, res) => {
  try {
    const { clientID, role } = req.user;
    const { fromDate, toDate } = req.query;

    // 🔢 Pagination for all tables
    const expiredPage = Number(req.query.expiredPage) || 1;
    const expiredLimit = Number(req.query.expiredLimit) || 7;
    const expiringPage = Number(req.query.expiringPage) || 1;
    const expiringLimit = Number(req.query.expiringLimit) || 7;
    const convertedPage = Number(req.query.convertedPage) || 1;
    const convertedLimit = Number(req.query.convertedLimit) || 7;

    // 🆕 NEW: Expiring soon days parameter (default: 7)
    const expiringSoonDays = Number(req.query.expiringSoonDays) || 7;

    const expiredSkip = (expiredPage - 1) * expiredLimit;
    const expiringSkip = (expiringPage - 1) * expiringLimit;
    const convertedSkip = (convertedPage - 1) * convertedLimit;

    // 🔐 Role based base query
    let baseQuery = {};
    if (role === "SuperAdmin") baseQuery = {};
    else if (role === "Partner" || role === "SubPartner")
      baseQuery = { parent: req.user.id };
    else if (role === "Admin" || role === "Client") baseQuery = { clientID };
    else
      return res.status(403).json({ success: false, message: "Unauthorized" });
    console.log("Base Query:", baseQuery);

    const now = new Date();

    const demoExpiryFilter = buildDateRange("demoExpiry", fromDate, toDate);
    const convertedDateFilter = buildDateRange(
      "demoHistory.timestamp",
      fromDate,
      toDate
    );

    // 1️⃣ Expired demos (WITH PAGINATION)
    const [expiredDemoClients, totalExpiredCount] = await Promise.all([
      User.find({
        ...baseQuery,
        role: "Client",
        isDemo: true,
        demoExpiry: { $lt: now },
        ...demoExpiryFilter,
        status: { $nin: ["delete"] },
      })
        .select("name email demoExpiry demoPeriod createdAt")
        .sort({ demoExpiry: -1 })
        .skip(expiredSkip)
        .limit(expiredLimit)
        .lean(),

      User.countDocuments({
        ...baseQuery,
        role: "Client",
        isDemo: true,
        demoExpiry: { $lt: now },
        ...demoExpiryFilter,
        status: { $nin: ["delete"] },
      }),
    ]);

    // 2️⃣ Active demos (no pagination, optional for summary)
    const activeDemoClients = await User.find({
      ...baseQuery,
      role: "Client",
      isDemo: true,
      demoExpiry: { $gte: now },
      status: { $nin: ["delete"] },
    })
      .select("name email demoExpiry demoPeriod createdAt")
      .lean();

    // 3️⃣ Converted demos (WITH PAGINATION)
    const [convertedClients, totalConvertedCount] = await Promise.all([
      User.find({
        ...baseQuery,
        role: "Client",
        isDemo: false,
        "demoHistory.action": "converted",
        ...convertedDateFilter,
        status: { $nin: ["delete"] },
      })
        .select("name email createdAt demoHistory")
        .sort({ createdAt: -1 })
        .skip(convertedSkip)
        .limit(convertedLimit)
        .lean(),

      User.countDocuments({
        ...baseQuery,
        role: "Client",
        isDemo: false,
        "demoHistory.action": "converted",
        ...convertedDateFilter,
        status: { $nin: ["delete"] },
      }),
    ]);

    // ⏳ Expiring soon (WITH CUSTOM DAYS & PAGINATION) 🆕
    const expiringDate = new Date(
      now.getTime() + expiringSoonDays * 24 * 60 * 60 * 1000
    );

    const [expiringSoonClients, totalExpiringCount] = await Promise.all([
      User.find({
        ...baseQuery,
        role: "Client",
        isDemo: true,
        demoExpiry: { $gte: now, $lte: expiringDate }, // 🆕 Use custom days
        status: { $nin: ["delete"] },
      })
        .select("name email demoExpiry")
        .sort({ demoExpiry: 1 })
        .skip(expiringSkip)
        .limit(expiringLimit)
        .lean(),

      User.countDocuments({
        ...baseQuery,
        role: "Client",
        isDemo: true,
        demoExpiry: { $gte: now, $lte: expiringDate }, // 🆕 Use custom days
        status: { $nin: ["delete"] },
      }),
    ]);
    console.log(
      "Expiring Soon Clients:",
      expiringSoonClients,
      totalExpiringCount
    );
    // 📊 Timeline (last 30 days default)
    const timelineFrom =
      fromDate || toDate
        ? new Date(fromDate)
        : new Date(new Date().setDate(new Date().getDate() - 30));

    const expiredTimeline = await User.aggregate([
      {
        $match: {
          ...baseQuery,
          role: "Client",
          isDemo: true,
          demoExpiry: { $gte: timelineFrom, $lt: now },
          status: { $nin: ["delete"] },
        },
      },
      {
        $project: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$demoExpiry" } },
        },
      },
      { $group: { _id: "$date", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const convertedTimeline = await User.aggregate([
      {
        $match: {
          ...baseQuery,
          role: "Client",
          isDemo: false,
          "demoHistory.action": "converted",
          status: { $nin: ["delete"] },
        },
      },
      { $unwind: "$demoHistory" },
      {
        $match: {
          "demoHistory.action": "converted",
          ...buildDateRange("demoHistory.timestamp", fromDate, toDate),
        },
      },
      {
        $project: {
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$demoHistory.timestamp",
            },
          },
        },
      },
      { $group: { _id: "$date", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // 📈 Summary
    const totalExpired = totalExpiredCount;
    const totalActive = activeDemoClients.length;
    const totalConverted = totalConvertedCount;

    const totalDemo = totalExpired + totalActive + totalConverted;
    const conversionRate =
      totalDemo > 0 ? ((totalConverted / totalDemo) * 100).toFixed(2) : 0;

    return res.json({
      success: true,
      data: {
        summary: {
          totalExpired,
          totalActive,
          totalConverted,
          conversionRate: Number(conversionRate),
        },
        charts: {
          expiredTimeline: expiredTimeline.map((i) => ({
            date: i._id,
            count: i.count,
          })),
          convertedTimeline: convertedTimeline.map((i) => ({
            date: i._id,
            count: i.count,
          })),
        },
        expiredDemoClients,
        expiringSoonClients,
        convertedClients,
        pagination: {
          expired: {
            page: expiredPage,
            limit: expiredLimit,
            totalRecords: totalExpiredCount,
            totalPages: Math.ceil(totalExpiredCount / expiredLimit),
          },
          expiring: {
            page: expiringPage,
            limit: expiringLimit,
            totalRecords: totalExpiringCount,
            totalPages: Math.ceil(totalExpiringCount / expiringLimit),
          },
          converted: {
            page: convertedPage,
            limit: convertedLimit,
            totalRecords: totalConvertedCount,
            totalPages: Math.ceil(totalConvertedCount / convertedLimit),
          },
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Demo analytics failed" });
  }
};

exports.getDemoStatsSummary = async (req, res) => {
  try {
    const { clientID, role } = req.user;
    const { fromDate, toDate } = req.query;

    // 🆕 NEW: Expiring soon days parameter (default: 7)
    const expiringSoonDays = Number(req.query.expiringSoonDays) || 7;

    let baseQuery = {};
    if (role === "SuperAdmin") baseQuery = {};
    else if (role === "Partner" || role === "SubPartner")
      baseQuery = { parent: req.user.id };
    else if (role === "Admin" || role === "Client") baseQuery = { clientID };
    else
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    const now = new Date();

    const expiredDemoDateFilter = buildDateRange(
      "demoExpiry",
      fromDate,
      toDate
    );

    const convertedDateFilter = buildDateRange(
      "demoHistory.timestamp",
      fromDate,
      toDate
    );

    // 🆕 Calculate expiring date based on custom days
    const expiringDate = new Date(
      now.getTime() + expiringSoonDays * 24 * 60 * 60 * 1000
    );

    const [
      totalActiveDemo,
      totalExpiredDemo,
      totalConverted,
      expiringSoonCount,
    ] = await Promise.all([
      // Active demo (no date filter)
      User.countDocuments({
        ...baseQuery,
        role: "Client",
        isDemo: true,
        demoExpiry: { $gte: now },
        status: { $nin: ["delete"] },
      }),

      // Expired demo
      User.countDocuments({
        ...baseQuery,
        role: "Client",
        isDemo: true,
        demoExpiry: { $lt: now },
        ...expiredDemoDateFilter,
        status: { $nin: ["delete"] },
      }),

      // Converted
      User.countDocuments({
        ...baseQuery,
        role: "Client",
        isDemo: false,
        "demoHistory.action": "converted",
        ...convertedDateFilter,
        status: { $nin: ["delete"] },
      }),

      // Expiring soon (with custom days) 🆕
      User.countDocuments({
        ...baseQuery,
        role: "Client",
        isDemo: true,
        demoExpiry: {
          $gte: now,
          $lte: expiringDate, // 🆕 Use custom days
        },
        status: { $nin: ["delete"] },
      }),
    ]);

    const totalDemo = totalActiveDemo + totalExpiredDemo + totalConverted;

    const conversionRate =
      totalDemo > 0 ? ((totalConverted / totalDemo) * 100).toFixed(2) : 0;

    return res.json({
      success: true,
      data: {
        totalActiveDemo,
        totalExpiredDemo,
        totalConverted,
        expiringSoonCount,
        conversionRate: Number(conversionRate),
      },
    });
  } catch (error) {
    console.error("getDemoStatsSummary error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Stats fetch failed" });
  }
};

exports.getClientUsers = async (req,res) => {
  try {
    const { clientId } = req.params;
    if(!clientId) {
      return res.status(400).json({ success: false, message: "Client ID not found for the user" });
    }
    const users = await User.find({ clientID: clientId, status: { $ne: "delete" } }).select("name email role status createdAt lastLogin");
    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  }catch{
    console.error("getClientUsers error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Client users fetch failed" });  
  }
}

exports.exportClientsUsers = async (req, res) => {
  try {
    const {
      search = "",
      status = "",
      partnerId = "",
      subPartnerId = "",
    } = req.query;

    const userId = req.user.id;
    const user = await User.findById(userId);

    const matchStage = {
      role: "Client",
      status: { $ne: "delete" },
    };

    if (user.role === "Partner" || user.role === "SubPartner") {
      matchStage.parent = new mongoose.Types.ObjectId(userId);
    } else {
      if (partnerId) matchStage.parent = new mongoose.Types.ObjectId(partnerId);
      if (subPartnerId) {
        matchStage.parent = new mongoose.Types.ObjectId(subPartnerId);
      }
    }

    if (status) matchStage.status = status;

    if (search?.trim()) {
      matchStage.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    const clients = await User.find(matchStage)
      .sort({ createdAt: -1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Clients & Users");

    // sheet.columns = [
    //   { header: "Name", key: "name", width: 30 },
    //   { header: "Email", key: "email", width: 35 },
    //   { header: "Role", key: "role", width: 15 },
    //   { header: "Status", key: "status", width: 15 },
    //   { header: "Last Login", key: "lastLogin", width: 25 },
    // ];

    /* ---------------- REPORT HEADER ---------------- */
    sheet.addRow(["CLIENTS & USERS REPORT"]).font = { bold: true };
    sheet.addRow(["Exported By", user.name]);
    sheet.addRow(["Role", user.role]);
    sheet.addRow(["Exported On", new Date().toLocaleString()]);
    sheet.addRow([]);

    let clientIndex = 1;

    /* ---------------- LOOP CLIENTS ---------------- */
    for (const client of clients) {
      const clientHeader = sheet.addRow([
        `CLIENT ${clientIndex} - ${client.name}`,
      ]);
      clientHeader.font = { bold: true };

      sheet.addRow(["Client Code", client.code || "-"]);
      sheet.addRow(["Email", client.email]);
      sheet.addRow(["Status", client.status]);
      sheet.addRow([
        "Demo Account",
        client.isDemo ? "Yes" : "No",
      ]);
      sheet.addRow([
        "Demo Period",
        client.demoPeriod ? `${client.demoPeriod} Days` : "-",
      ]);
      sheet.addRow(["User Limit", client.limit ?? "-"]);
      sheet.addRow([]);

      /* -------- USERS OF CLIENT -------- */
      const users = await User.find({
        clientID: client._id,
        status: { $ne: "delete" },
      })
        .select("name email role status lastLogin")
        .lean();

      const usersHeader = sheet.addRow([
        `USERS (Total: ${users.length})`,
      ]);
      usersHeader.font = { bold: true };

      const tableHeader = sheet.addRow([
        "Name",
        "Email",
        "Role",
        "Status",
        "Last Login",
      ]);
      tableHeader.font = { bold: true };

      users.forEach((u) => {
        sheet.addRow([
          u.name,
          u.email,
          u.role,
          u.status,
          u.lastLogin
            ? new Date(u.lastLogin).toLocaleString()
            : "Never",
        ]);
      });

      sheet.addRow([]);
      sheet.addRow([
        "------------------------------------------------------------",
      ]);
      sheet.addRow([]);

      clientIndex++;
    }

    /* ---------------- SEND FILE (IMPORTANT PART) ---------------- */
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Clients_Users_Report.xlsx"
    );

    // ✅ DO NOT call res.end()
    await workbook.xlsx.write(res);

  } catch (error) {
    console.error("Export error:", error);

    // ✅ Prevent corrupting response if headers already sent
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Excel export failed",
      });
    }
  }
};
