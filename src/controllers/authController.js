const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const User = require('../models/User');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

exports.register = asyncHandler(async (req, res) => {
    console.log(req.body,"===================");
const { name, email, password, role, subRole, company, createdBy } = req.body;
if (!name || !email || !password || !role) throw new ApiError(400, 'Missing fields');
const exists = await User.findOne({ email });
if (exists) throw new ApiError(409, 'Email already in use');
const hash = await bcrypt.hash(password, 10);
const user = await User.create({ name, email, password: hash, role, subRole, company, createdBy });
res.status(201).json(new ApiResponse(201, { id: user._id }));
});

exports.login = asyncHandler(async (req, res) => {
const { email, password } = req.body;
const user = await User.findOne({ email });
if (!user) throw new ApiError(401, 'Invalid credentials');
const ok = await bcrypt.compare(password, user.password);
if (!ok) throw new ApiError(401, 'Invalid credentials');
const token = signToken(user._id);
const safe = user.toObject();
delete safe.password;
res.json(new ApiResponse(200, { token, user: safe }));
});


