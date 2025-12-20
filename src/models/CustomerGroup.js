const mongoose = require("mongoose");
const Counter = require("./Counter");

const CustomerGroupSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    groupName: {
      type: String,
      required: true,
      trim: true,
    },

    groupCode: {
      type: String,
      unique: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active",
    },

    parentGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CustomerGroup",
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

/**
 * AUTO GENERATE groupCode
 * - Atomic
 * - Bulk safe
 * - insertMany safe
 */
CustomerGroupSchema.pre("validate", async function (next) {
  try {
    if (this.groupCode) return next();

    const Counter = mongoose.model("Counter");

    const counter = await Counter.findOneAndUpdate(
      {
        clientId: this.clientId,
        companyId: this.companyId,
        type: "customerGroup",
      },
      { $inc: { seq: 1 } },
      {
        new: true,
        upsert: true,
      }
    );

    this.groupCode = counter.seq.toString().padStart(12, "0");

    next();
  } catch (error) {
    next(error);
  }
});

// Indexes
CustomerGroupSchema.index({ clientId: 1 });
CustomerGroupSchema.index({ companyId: 1 });
CustomerGroupSchema.index({ groupName: 1 });
CustomerGroupSchema.index({ groupCode: 1 });

module.exports = mongoose.model("CustomerGroup", CustomerGroupSchema);
