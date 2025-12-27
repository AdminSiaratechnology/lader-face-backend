const parseMonthYear = (str) => {
  if (!str || !str.trim()) return null;
  const [year, month] = str.trim().split("-");
  if (!year || !month) return null;
  return new Date(Date.UTC(+year, +month - 1, 1));
};
module.exports={parseMonthYear};