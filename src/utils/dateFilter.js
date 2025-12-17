// utils/dateFilter.js
module.exports = function buildDateRange(field, fromDate, toDate) {
  if (!fromDate && !toDate) return {};

  const range = {};
  if (fromDate) range.$gte = new Date(fromDate);
  if (toDate) range.$lte = new Date(toDate);

  return { [field]: range };
};
