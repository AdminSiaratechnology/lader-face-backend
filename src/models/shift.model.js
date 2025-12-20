const mongoose = require("mongoose");
/* -----------------------------
   CASH DENOMINATION SCHEMA
----------------------------- */
const CashDenominationSchema = new mongoose.Schema(
  {
    denominations: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      5: { type: Number, default: 0 },
      10: { type: Number, default: 0 },
      20: { type: Number, default: 0 },
      50: { type: Number, default: 0 },
      100: { type: Number, default: 0 },
      200: { type: Number, default: 0 },
      500: { type: Number, default: 0 },
    },

    totalCash: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

/* -----------------------------
   SHIFT SCHEMA
----------------------------- */
const ShiftSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

   

    sessionStart: {
      type: Date,
      required: true,
    },

    sessionEnd: {
      type: Date,
      required: true,
    },

    openingCash: {
      type: Number,
      default: 0,
    },

    cashSales: {
      type: Number,
      default: 0,
    },

    cardSales: {
      type: Number,
      default: 0,
    },

    upiSales: {
      type: Number,
      default: 0,
    },

    expectedClosingCash: {
      type: Number,
      required: true,
    },

    actualCashCounted: {
      type: Number,
      required: true,
    },

    difference: {
      type: Number,
      default: 0,
    },

    cashDenomination: {
      type: CashDenominationSchema,
      required: true,
    },

    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
    },
  },
  { timestamps: true }
);

/* -----------------------------
   AUTO DIFFERENCE CALC
----------------------------- */
ShiftSchema.pre("save", function (next) {
  this.difference = this.actualCashCounted - this.expectedClosingCash;
  next();
});

module.exports =mongoose.model("Shift", ShiftSchema);
