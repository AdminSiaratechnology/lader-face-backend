const mongoose = require("mongoose");

const priceLevelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // stockGroupId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "StockGroup",
    //   required: true,
    // },

    // stockGroupName: {
    //   type: String,
    //   required: true,
    //   trim: true,
    // },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PriceLevel", priceLevelSchema);
