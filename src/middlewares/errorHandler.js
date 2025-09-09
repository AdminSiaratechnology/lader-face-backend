const ApiError = require('../utils/apiError');


// 404
const notFound = (req, res, next) => next(new ApiError(404, 'Route not found'));


// Global handler
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
const status = err.statusCode || 500;
const message = err.message || 'Internal Server Error';
if (process.env.NODE_ENV !== 'test') {
console.error('❌', err);
}
res.status(status).json({ status, message });
};


module.exports = { notFound, errorHandler };