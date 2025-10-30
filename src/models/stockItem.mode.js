const mongoose = require("mongoose");

const godownDetailSchema = new mongoose.Schema(
  {
    GodownName: { type: String, required: true },
    BatchName: { type: String, required: true },
    Qty: { type: Number, required: true },
  },
  { _id: false }
);

const stockItemSchema = new mongoose.Schema(
  {
    ItemName: { type: String, required: true },
    ItemCode: { type: String, required: true },
    Group: { type: String, required: true },
    Category: { type: String, required: true },
    TotalQty: { type: Number, required: true },
    MRP: { type: Number },
    Discount: { type: Number },
    Price: { type: Number },
    SyncDate: { type: Date, default: Date.now },
    GodownDetails: {
      type: [godownDetailSchema],
      required: true,
      validate: [
        (val) => val.length > 0,
        "At least one Godown detail is required.",
      ],
    },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active",
      required: true,
    },
  },
  { timestamps: true }
);

const StockItem = mongoose.model("StockItem", stockItemSchema);

module.exports = StockItem;
