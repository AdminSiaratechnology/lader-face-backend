const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const User = require('../models/User');
const { use } = require('../routes/authRoutes');

const signToken = (userId, clientAgent,role) => {
  return jwt.sign(
    { id: userId, clientAgent,role }, // payload me include karo
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

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
      user,
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

  // ✅ Email uniqueness check
  if (updateData.email && updateData.email !== user.email) {
    const exists = await User.findOne({ email: updateData.email });
    if (exists) throw new ApiError(409, "Email already in use");
  }

  // ✅ Handle password hashing if password is being updated
  if (updateData.password && updateData.password.trim()) {
    updateData.password = await bcrypt.hash(updateData.password, 10);
  } else {
    delete updateData.password; // Don't overwrite with empty
  }

  // ✅ Update fields safely
  Object.entries(updateData).forEach(([key, value]) => {
    if (value !== undefined) {
      user[key] = value;
    }
  });

  await user.save();

  // ✅ Remove sensitive data before sending response
  const userResponse = user.toObject();
  delete userResponse.password;

  // Final response
  res.status(200).json(
    new ApiResponse(200, userResponse, "User updated successfully")
  );
});


exports.deleteUser=asyncHandler(async (req,res)=>{
  const {id}=req.params;
  // Check if user exists
  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");
  user.status="delete"
  user.save()
 // Final response
  res.status(200).json(
    new ApiResponse(
      200,
      { id: user._id },
      "User deleted successfully"
    )
  );


})

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  // Case-insensitive email search
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new ApiError(401, "Invalid credentials");

  // Password check
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new ApiError(401, "Invalid credentials");

  // JWT token generation
  const token = signToken(user._id, user.clientAgent,user?.role);
  console.log(user)

  // Remove sensitive info
  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.__v;
  safeUser.access=[...user.access]

  res.status(200).json(
    new ApiResponse(200, { token, user: safeUser }, "Login successful")
  );
});

