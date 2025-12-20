const Shift = require("../models/shift.model.js");

exports.closeShift = async (req, res) => {
  try {
    const data = req.body;
    console.log(data , "backend wefghbghwerfghmn")
    data.sessionEnd = new Date();
    data.status = "CLOSED";

   if (
  data.cashSales > 0 &&
  (!data.actualCashCounted || Number(data.actualCashCounted) <= 0)
) {
  return res.status(400).json({
    success: false,
    message: "Actual cash counted is required",
  });
}
    const shift = await Shift.create(data);

    res.json({
      success: true,
      message: "Shift closed successfully",
      data: shift,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Something went wrong while closing shift",
    });
  }
};
