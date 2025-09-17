const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const User = require('../models/User');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// exports.register = asyncHandler(async (req, res) => {
//   // const adminId = req?.user?.id;
//   const adminId = "68c90c0349eef6537230452c";
//   // res.status(200).json({ adminId, message: "Register Controller is working" });
//   // console.log("Admin ID from req.user:", adminId);
//   const { name, email, password, role, subRole, company, createdBy , parent, clientAgent ,} = req.body;
//   console.log(req.body);
//   if (!name || !email || !password || !role) throw new ApiError(400, 'Missing fields');
  
//   const exists = await User.findOne({ email });
//   // console.log(adminId);
//   const creatorInfo = await User.findById(adminId);

//   // console.log("Creator Info:", creatorInfo);
//   // res.status(200).json({ creatorInfo, message: "Register Controller is working" });
//   if (exists) throw new ApiError(409, 'Email already in use');
  
//   const hash = await bcrypt.hash(password, 10);
//   res.status(200).json({ password: hash, clientAgent: creatorInfo?.clientAgent || null, createdBy: creatorInfo?._id, parent: creatorInfo?._id, message: "Register Controller is working" });
//   const user = await User.create({ ...req.body, password: hash, clientAgent: creatorInfo?.clientAgent || null, createdBy: creatorInfo?._id, parent: creatorInfo?._id });

//   res.status(201).json(new ApiResponse(201, { id: user._id }, "User registered successfully"));
// });
exports.register = asyncHandler(async (req, res) => {
  const adminId = req.user.id; // Hardcoded admin (later tu req.user se lega)

  const { name, email, password, role, subRole, company, createdBy, parent, clientAgent } = req.body;
  console.log(req.body);

  // Required fields check
  if (!name || !email || !password || !role) {
    throw new ApiError(400, "Missing fields");
  }

  // Check if user already exists
  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(409, "Email already in use");

  // Find creator info
  const creatorInfo = await User.findById(adminId);

  // Hash password
  const hash = await bcrypt.hash(password, 10);

  // Create new user
  const user = await User.create({
    ...req.body,
    password: hash,
    clientAgent: creatorInfo?.clientAgent || null,
    createdBy: creatorInfo?._id,
    parent: creatorInfo?._id,
  });

  // Final response
  res.status(201).json(
    new ApiResponse(
      201,
      { id: user._id },
      "User registered successfully"
    )
  );
});
exports.updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params; // userId to update
  const updateData = { ...req.body };

  // Check if user exists
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");

  // Email uniqueness check
  if (updateData.email && updateData.email !== user.email) {
    const exists = await User.findOne({ email: updateData.email });
    if (exists) throw new ApiError(409, "Email already in use");
  }

  // Handle password hashing if password is being updated
  if (updateData.password) {
    updateData.password = await bcrypt.hash(updateData.password, 10);
  }

  // Update user with new data
  Object.keys(updateData).forEach((key) => {
    user[key] = updateData[key];
  });

  await user.save();

  // Final response
  res.status(200).json(
    new ApiResponse(
      200,
      { id: user._id },
      "User updated successfully"
    )
  );
});

exports.deleteUser=asyncHandler(async (req,res)=>{
  const {id}=req.params;
  // Check if user exists
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");
  user.status="delete"
  user.save()


})

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(401, 'Invalid credentials');
  
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new ApiError(401, 'Invalid credentials');
  
  const token = signToken(user._id);
  const safe = user.toObject();
  delete safe.password;
  
  res.json(new ApiResponse(200, { token, user: safe }, "Login successful"));
});
