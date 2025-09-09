const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/apiError');


const auth = async (req, res, next) => {
const header = req.headers.authorization || '';
const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;
if (!token) return next(new ApiError(401, 'Unauthorized'));


try {
const payload = jwt.verify(token, process.env.JWT_SECRET);
const user = await User.findById(payload.id).select('-password');
if (!user) return next(new ApiError(401, 'Invalid token'));
req.user = user;
next();
} catch (e) {
next(new ApiError(401, 'Invalid/Expired token'));
}
};


module.exports = auth;