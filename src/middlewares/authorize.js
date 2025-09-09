const ApiError = require('../utils/apiError');


// requires role OR subRole match
const allow = ({ roles = [], subRoles = [] } = {}) => (req, res, next) => {
const user = req.user;
if (!user) return next(new ApiError(401, 'Unauthorized'));


const roleOk = roles.length ? roles.includes(user.role) : true;
const subOk = subRoles.length ? (Array.isArray(user.subRole) && user.subRole.some(r => subRoles.includes(r))) : true;


if (!roleOk || !subOk) return next(new ApiError(403, 'Forbidden'));
next();
};


module.exports = { allow };