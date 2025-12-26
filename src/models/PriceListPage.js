const mongoose = require("mongoose");

const priceListPageSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    priceLevel: {
      type: String,
      required: true,
    },

    stockGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockGroup",
      required: true,
    },

    stockGroupName: {
      type: String,
    },

    applicableFrom: {
      type: String,
      required: true,
    },

    page: {
      type: Number,
      required: true,
    },

    items: [
      {
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },

        itemName: {
          type: String,
          required: true,
        },

        slabs: [
          {
            fromQty: Number,
            lessThanQty: Number,
            rate: Number,
            discount: Number,
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

/* 🔒 one page = one document */
priceListPageSchema.index(
  {
    companyId: 1,
    clientId: 1,
    priceLevel: 1,
    stockGroupId: 1,
    applicableFrom: 1,
    page: 1,
  },
  { unique: true }
);

module.exports = mongoose.model("PriceListPage", priceListPageSchema);
