const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const User = require("../models/User");
const mongoose = require("mongoose");
const { createAuditLog } = require("../utils/createAuditLog");
const { generate6DigitUniqueId } = require("../utils/generate6DigitUniqueId");
const Customer = require("../models/Customer");
const sendEmail = require("../utils/sendEmail");

// 🔐 Token Generator
const signToken = (userId, clientID, role) => {
  return jwt.sign({ id: userId, clientID, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// ✅ REGISTER USER
exports.register = asyncHandler(async (req, res) => {
  const adminId = req?.user?.id;
  const {
    name,
    email,
    password,
    role,
    city,
    country,
    state,
    area,
    limit,
    pincode,
    region,
    multiplePhones,
    clientID,
  } = req.body;
  let access = structuredClone(req.body.access);

  if (!name || !email || !password || !role) {
    throw new ApiError(400, "Missing required fields");
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw new ApiError(409, "Email already in use");

  const creatorInfo = await User.findById(adminId);
  const hash = await bcrypt.hash(password, 10);
  const uploadedDocs = req.files?.documents || [];
  const uploadedUrls = uploadedDocs.map((file) => file.location);

  // Final documents array (uploaded OR body OR fallback)
  const finalDocuments =
    uploadedUrls.length > 0
      ? uploadedUrls
      : Array.isArray(req.body.documents)
      ? req.body.documents
      : [];

  const user = await User.create({
    ...req.body,
    email: email.toLowerCase(),
    password: hash,
    clientID: clientID || creatorInfo?.clientID,
    createdBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
    parent: creatorInfo?._id || null,
    city,
    country,
    state,
    area,
    limit,
    pincode,
    region,
    access: access,
    documents: finalDocuments,
    multiplePhones,
    auditLogs: [
      {
        action: "create",
        performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
        timestamp: new Date(),
        details: "User created",
      },
    ],
  });
  if (role === "Client") {
    const assignedLimit = limit || 0;

    // Only check/deduct if creator is Partner
    if (creatorInfo.role === "Partner") {
      const partnerRemainingLimit = creatorInfo.limit || 0;

      if (assignedLimit > partnerRemainingLimit) {
        throw new ApiError(
          400,
          `Partner limit exceeded. You have ${partnerRemainingLimit} remaining.`
        );
      }

      // Deduct assigned limit from Partner
      await User.updateOne(
        { _id: creatorInfo._id },
        {
          $inc: { limit: -assignedLimit },
        }
      );
    }

    // Assign initial limit to the Client regardless of creator role
    if (assignedLimit > 0) {
      await User.updateOne(
        { _id: user._id },
        {
          $push: {
            limitHistory: {
              performedBy: adminId
                ? new mongoose.Types.ObjectId(adminId)
                : null,
              initialLimit: assignedLimit,
              previousLimit: 0,
              newLimit: assignedLimit,
              action: "assigned",
              reason:
                creatorInfo.role === "Partner"
                  ? "Initial limit assigned by Partner"
                  : "Initial limit assigned by SuperAdmin",
              timestamp: new Date(),
            },
          },
        }
      );
    }
  }

  if (role === "Admin") {
    const clientID = user.clientID;
    console.log("clientID: ", clientID);
    await User.updateOne(
      { _id: clientID },
      { $inc: { limit: -1 } } // Decrease by 1
    );
  }
  if (role === "Partner" && limit) {
    await User.updateOne(
      { _id: user._id },
      {
        $push: {
          limitHistory: {
            performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
            initialLimit: limit,
            previousLimit: 0,
            newLimit: limit,
            action: "assigned",
            reason: "Initial limit assigned on creation",
            timestamp: new Date(),
          },
        },
      }
    );
  }
  if (role === "Customer" && Array.isArray(access) && access.length > 0) {
    console.log("Auto-creating customers for access:", access);
    for (const acc of access) {
      const companyId = acc.company;

      if (!companyId) continue;

      const code = await generateUniqueId(Customer, "code");

      const customer = await Customer.create({
        company: companyId,
        clientId: creatorInfo?.clientID || adminId,

        // Required fields
        customerName: name,
        contactPerson: name,
        emailAddress: email.toLowerCase(),
        customerType: "company",
        code,

        createdBy: adminId,
        auditLogs: [
          {
            action: "create",
            performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
            timestamp: new Date(),
            details: "Customer auto-created from user registration",
          },
        ],
      });

      // ✅ Debug log
      console.log(
        `✅ Auto-Created Customer --> ID: ${
          customer._id
        }, Company: ${companyId}, Code: ${code}, Email: ${email.toLowerCase()}`
      );
    }
  }
  const code = await generate6DigitUniqueId(User, "code");
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        code,
      },
    }
  );
  // After all role-based updates (Client, Admin deduction, Partner limit history, Customer auto-creation)
  // BEFORE generating code

  // 📩 Send email to Admin user with credentials
  if (role === "Admin") {
    const emailSubject = "Your Admin Account Credentials";
    const emailText = `
Hello ${name},

Your admin account has been created successfully.

Login Credentials:
Email: ${email}
Password: ${password}

Please log in to continue working.

Regards,
Team
`;

    const emailHtml = `
  <p>Hello <strong>${name}</strong>,</p>
  <p>Your admin account has been successfully created.</p>
  <p><strong>Login Credentials:</strong></p>
  <ul>
    <li><strong>Email:</strong> ${email}</li>
    <li><strong>Password:</strong> ${password}</li>
  </ul>
  <p>Please change your password after first login.</p>
  <br/>
  <p>Regards,<br/>Team</p>
  `;

    const emailStatus = await sendEmail({
      to: email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    });

    if (!emailStatus.success) {
      console.error(
        "⚠️ Failed to send admin credentials email:",
        emailStatus.error
      );
    }
  }

  const userResponse = user.toObject();
  delete userResponse.password;

  res
    .status(201)
    .json(new ApiResponse(201, userResponse, "User registered successfully"));
});
// ✅ REGISTER USER
exports.registerInside = asyncHandler(async (req, res) => {
  const adminId = req?.user?.id;
  const { name, email, password, role } = req.body;
  let access = structuredClone(req.body.access);
  console.log(access, "access");

  if (!name || !email || !password || !role) {
    throw new ApiError(400, "Missing required fields");
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw new ApiError(409, "Email already in use");

  const creatorInfo = await User.findById(adminId);
  const hash = await bcrypt.hash(password, 10);

  const user = await User.create({
    ...req.body,
    email: email.toLowerCase(),
    password: hash,
    clientID: null,
    createdBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
    parent: creatorInfo?._id || null,
    lastLogin: new Date(),
    access: structuredClone(req.body.access),
    auditLogs: [
      {
        action: "create",
        performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
        timestamp: new Date(),
        details: "User created",
      },
    ],
  });

  const userResponse = user.toObject();
  delete userResponse.password;
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }

  console.log(ipAddress, "ipaddress");
  await createAuditLog({
    module: "User",
    action: "create",
    performedBy: req.user.id,
    referenceId: user._id,
    clientId: req.user.clientID,
    details: "User created successfully",
    ipAddress,
  });

  res
    .status(201)
    .json(new ApiResponse(201, userResponse, "User registered successfully"));
});

// ✅ UPDATE USER
exports.updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body, clientID: req.user.clientID };
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");

  // Email uniqueness check
  if (updateData.email && updateData.email !== user.email) {
    const exists = await User.findOne({
      email: updateData.email.toLowerCase(),
    });
    if (exists) throw new ApiError(409, "Email already in use");
    updateData.email = updateData.email.toLowerCase();
  }

  // Password hashing if updated
  if (updateData.password && updateData.password.trim()) {
    updateData.password = await bcrypt.hash(updateData.password, 10);
  } else {
    delete updateData.password;
  }

  // Store old data before update
  const oldData = user.toObject();

  Object.entries(updateData).forEach(([key, value]) => {
    if (["createdBy", "createdAt", "_id", "password"].includes(key)) return;

    if (["parent", "company"].includes(key)) {
      if (value && mongoose.Types.ObjectId.isValid(value)) {
        user[key] = new mongoose.Types.ObjectId(value);
      } else {
        // If empty or invalid, explicitly set to null
        user[key] = null;
      }
    } else {
      user[key] = value;
    }
  });
  // Safely get uploaded documents
  const uploadedDocs = req.files?.documents || []; // this will be an array
  const uploadedUrls = uploadedDocs.map(
    (file) => file.location || file.path || file.originalname
  );

  // Merge new uploaded files with existing documents
  user.documents = [...(user.documents || []), ...uploadedUrls];
  // Track changed fields for audit logs
  const changes = {};
  for (const key in updateData) {
    if (["createdBy", "createdAt", "_id"].includes(key)) continue;
    if (String(oldData?.[key]) !== String(updateData?.[key])) {
      changes[key] = { from: oldData?.[key], to: updateData?.[key] };
    }
  }

  // Add audit log entry
  user.auditLogs.push({
    action: "update",
    performedBy: new mongoose.Types.ObjectId(req.user.id),
    timestamp: new Date(),
    details: "User updated",
    changes,
  });

  await user.save();

  const userResponse = user.toObject();
  delete userResponse.password;
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "User",
    action: "update",
    performedBy: req.user.id,
    referenceId: user._id,
    clientId: req.user.clientID,
    details: "User updated successfully",
    changes,
    ipAddress,
  });

  res
    .status(200)
    .json(new ApiResponse(200, userResponse, "User updated successfully"));
});

// ✅ DELETE USER (soft delete)
exports.deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");

  user.status = "delete";

  // Log delete action
  user.auditLogs.push({
    action: "delete",
    performedBy: new mongoose.Types.ObjectId(req.user.id),
    timestamp: new Date(),
    details: "User marked as deleted",
  });

  await user.save();
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "User",
    action: "delete",
    performedBy: req.user.id,
    referenceId: user._id,
    clientId: req.user.clientID,
    details: "User marked as deleted",
    ipAddress,
  });

  res
    .status(200)
    .json(new ApiResponse(200, { id: user._id }, "User deleted successfully"));
});

// ✅ LOGIN USER
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    throw new ApiError(400, "Email and password are required");
  const user = await User.findOne({ email: email.toLowerCase() })
    .populate({
      path: "access.company",
      select: "namePrint logo nameStreet code",
    })
    .populate({
      path: "createdBy",
      select: "email name",
    });

  if (!user) throw new ApiError(401, "Invalid credentials");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new ApiError(401, "Invalid credentials");

  const token = signToken(user._id, user.clientID, user.role);

  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.__v;
  delete safeUser.loginHistory;
  delete safeUser.auditLogs;
  safeUser.access = [...(user.access || [])];

  // Update last login + log it
  const now = new Date();

  user.lastLogin = now;
  user.loginHistory.push(now);
  user.auditLogs.push({
    action: "login",
    performedBy: new mongoose.Types.ObjectId(user._id),
    timestamp: new Date(),
    details: "User logged in",
  });

  await user.save();
  // Fetch stats based on role
  let stats = {};

  if (user.role === "SuperAdmin") {
    // 1️⃣ Count partners
    const totalPartners = await User.countDocuments({
      role: "Partner",
      status: { $ne: "delete" },
    });

    // 2️⃣ Clients created by ANY superadmin
    const clients = await User.find({
      role: "Client",
      createdBy: user._id, // superadmin created
      status: { $ne: "delete" },
    }).select("_id");

    const clientIDs = clients.map((c) => c._id);

    // 3️⃣ Users under superadmin's clients
    const totalUsers = await User.countDocuments({
      clientID: { $in: clientIDs },
      status: { $ne: "delete" },
    });
    const allClients = await User.find({
      role: "Client",
      status: { $ne: "delete" },
    }).select("_id");

    const allClientIDs = allClients.map((c) => c._id);

    // 3️⃣ Users under superadmin's clients
    const allTotalUsers = await User.countDocuments({
      clientID: { $in: allClientIDs },
      status: { $ne: "delete" },
    });

    stats = {
      totalPartners,
      totalClients: clientIDs.length,
      totalUsers,
      totalAllClients: allClientIDs.length,
      totalAllUsers: allTotalUsers,
    };
  }

  // PARTNER STATS
  else if (user.role === "Partner") {
    // 1️⃣ Clients created by this partner
    const clients = await User.find({
      parent: user._id,
      role: "Client",
      status: { $ne: "delete" },
    }).select("_id");

    const clientIDs = clients.map((c) => c._id);

    // 2️⃣ Users under this partner's clients
    const totalUsers = await User.countDocuments({
      clientID: { $in: clientIDs },
      status: { $ne: "delete" },
    });

    stats = {
      totalClients: clientIDs.length,
      totalUsers,
    };
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, { token, user: safeUser, stats }, "Login successful")
    );
});
