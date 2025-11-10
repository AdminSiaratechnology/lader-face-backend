const mongoose = require("mongoose");
const orderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      unique: true,
      required: true,
      index: true,
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
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    orderSource: {
      type: String,
      enum: ["website", "mobile_app", "pos", "api"],
      default: "website",
      index: true,
    },
    shippingAddress: {
      street: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    billingAddress: {
      street: String,
      line2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          index: true,
        },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        total: { type: Number },
        discount: { type: Number, default: 0 },
      },
    ],
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    grandTotal: { type: Number },
    payment: {
      mode: {
        type: String,
        enum: ["cash", "credit", "upi", "bank_transfer", "card", "wallet"],
        default: "cash",
      },
      status: {
        type: String,
        enum: ["pending", "completed", "failed", "refunded"],
        default: "pending",
        index: true,
      },
      transactionId: String,
      amountPaid: Number,
      date: Date,
    },
    TallyTransactionID: { type: String, default: null, index: true },
    BillGenerated: { type: Boolean, default: false },
    InvoiceNumber: { type: String, default: null },
    TallyDate: { type: Date, default: null },
    syncDate: { type: Date, default: null },
    remarks: { type: String },
    updatedBy: { type: String },
    status: {
      type: String,
      enum: ["approved", "cancelled", "completed", "pending"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true }
);

orderSchema.index(
  { companyId: 1, clientId: 1, orderCode: 1 },
  { unique: true }
);
orderSchema.index({ companyId: 1, status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ payment: 1 });
orderSchema.index({ customerId: 1 });
orderSchema.index({ userId: 1 });
orderSchema.index({ orderSource: 1 });
orderSchema.index({ orderCode: -1 }, { unique: false });
// ✅ Auto-generate 12-digit orderCode per company+client
orderSchema.pre("validate", async function (next) {
  try {
    if (this.orderCode) return next();
    // ✅ Use existing model instead of redefining
    const Order = mongoose.models.Order || mongoose.model("Order");

    const lastOrder = await Order.findOne({
      companyId: this.companyId,
      clientId: this.clientId,
    })
      .sort({ createdAt: -1 })
      .select("orderCode");
    console.log(lastOrder, "lastOrder");
    let newCode = "000000000001";
    if (lastOrder && lastOrder.orderCode) {
      const lastNum = parseInt(lastOrder.orderCode, 10);
      const nextNum = (lastNum + 1).toString().padStart(12, "0");
      newCode = nextNum;
    }
    this.orderCode = newCode;
    next();
  } catch (err) {
    console.error("Error generating orderCode:", err);
    next(err);
  }
});
module.exports = mongoose.model("Order", orderSchema);
