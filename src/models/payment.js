const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    mode: {
      type: String,
      enum: ["cash", "upi", "bank_transfer", "cheque", "bkash"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "initiated", "delete"],
      default: "initiated",
      index: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    transactionId: {
      type: String,
      default: null,
    },
    documents: [
      {
        type: String,
      },
    ],

    remarks: {
      type: String,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ orderId: 1, createdAt: -1 });

module.exports = mongoose.model("Payment", paymentSchema);
