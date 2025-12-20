const mongoose = require("mongoose");

const CounterSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Client",
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Company",
    },

    type: {
      type: String,
      required: true, // e.g. "customerGroup"
    },

    seq: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Unique counter per client + company + type
CounterSchema.index(
  { clientId: 1, companyId: 1, type: 1 },
  { unique: true }
);

module.exports = mongoose.model("Counter", CounterSchema);
