// models/Sale.js
const mongoose = require("mongoose");

const paymentInfoSchema = new mongoose.Schema(
  {
    paymentType: {
      type: String,
      enum: ["Cash", "Card", "UPI", "SPLIT"],
      required: true,
    },
    payments: {
      cash: { type: Number, default: 0 },
      card: { type: Number, default: 0 },
      upi: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const posSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: true,
    unique: true,
  },

  companyId: {
    type: mongoose.Types.ObjectId,
    required: true,
    index: true,
  },

  customer: {
    name: String,
    phone: String,
    customerId: { type: mongoose.Types.ObjectId, ref: "Customer", default: null },
  },

  items: [
    {
      itemId: { type: mongoose.Types.ObjectId, ref: "StockItem" },
      name: String,
      code: String,
      qty: Number,
      price: Number,
      total: Number,
      batch: {
        stockItemId: {
          type: mongoose.Schema.Types.ObjectId,
        },
        batchName: {
          type: String,
        },
        godownName: {
          type: String,
        },
        availableQtyAtAdd: {
          type: Number,
        },
      },
    },
  ],

  subtotal: {
    type: Number,
    required: true,
  },

  gstAmount: {
    type: Number,
    default: 0,
  },

  totalAmount: {
    type: Number,
    required: true,
  },

  // ⭐ NEW STRUCTURE (IMPORTANT)
  paymentInfo: {
    type: paymentInfoSchema,
    required: true,
  },

  // Optional flags
  held: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("POS", posSchema);
