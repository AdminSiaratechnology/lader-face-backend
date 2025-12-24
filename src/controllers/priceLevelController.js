const PriceLevel = require("../models/PriceLevel");

exports.createPriceLevel = async (req, res) => {
  const { name, companyId } = req.body;
  console.log(req.user,"req.user")
  const clientId = req.user.clientID;

  const exists = await PriceLevel.findOne({
    name,
    companyId,
  });

  if (exists) {
    return res.status(400).json({
      message: "Price Level already exists",
    });
  }

  const priceLevel = await PriceLevel.create({
    name,
    companyId,
    clientId,
  });

  res.status(201).json({
    success: true,
    data: priceLevel,
  });
};


exports.getPriceLevels = async (req, res) => {
  const { companyId } = req.query;

  const priceLevels = await PriceLevel.find({ companyId })
    .sort({ createdAt: 1 });

  res.status(200).json({
    success: true,
    data: priceLevels,
  });
};
