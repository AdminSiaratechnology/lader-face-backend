const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const User = require("../models/User");
const mongoose = require("mongoose");

// 🔐 Token Generator
const signToken = (userId, clientID, role) => {
  return jwt.sign(
    { id: userId, clientID, role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ✅ REGISTER USER
exports.register = asyncHandler(async (req, res) => {
  const adminId = req?.user?.id;
  const { name, email, password, role } = req.body;

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
    clientID: creatorInfo?.clientID || adminId,
    createdBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
    parent: creatorInfo?._id || null,
    lastLogin: new Date(),
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

  res
    .status(201)
    .json(new ApiResponse(201, userResponse, "User registered successfully"));
});
// ✅ REGISTER USER
exports.registerInside = asyncHandler(async (req, res) => {
  const adminId = req?.user?.id;
  const { name, email, password, role } = req.body;

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

  res
    .status(201)
    .json(new ApiResponse(201, userResponse, "User registered successfully"));
});


// ✅ UPDATE USER
exports.updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");

  // Email uniqueness check
  if (updateData.email && updateData.email !== user.email) {
    const exists = await User.findOne({ email: updateData.email.toLowerCase() });
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

  // Apply updates safely
  Object.entries(updateData).forEach(([key, value]) => {
    // Ignore system fields that should not be updated
    if (["createdBy", "createdAt", "_id","password"].includes(key)) return;

    // Convert to ObjectId if schema expects it
    if (["parent", "clientID", "company"].includes(key) && value) {
      user[key] = new mongoose.Types.ObjectId(value);
    } else {
      user[key] = value;
    }
  });

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

  res
    .status(200)
    .json(new ApiResponse(200, { id: user._id }, "User deleted successfully"));
});

// ✅ LOGIN USER
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    throw new ApiError(400, "Email and password are required");

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new ApiError(401, "Invalid credentials");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new ApiError(401, "Invalid credentials");

  const token = signToken(user._id, user.clientID, user.role);

  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.__v;
  safeUser.access = [...(user.access || [])];

  // Update last login + log it
  user.lastLogin = new Date();
  user.auditLogs.push({
    action: "login",
    performedBy: new mongoose.Types.ObjectId(user._id),
    timestamp: new Date(),
    details: "User logged in",
  });

  await user.save();

  res.status(200).json(
    new ApiResponse(200, { token, user: safeUser }, "Login successful")
  );
});
