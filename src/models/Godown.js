const mongoose = require("mongoose");
const auditLogSchema = require("../middlewares/auditLogSchema");

const godownSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      // required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      // required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Client role wala user
      // required: true,
    },
      clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Client role wala user
      // required: true,
    },
    code: { type: String, required: true, },
    name: { type: String, required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Godown" },
    address: { type: String },
    state: { type: String },
    city: { type: String },
    country: { type: String },
    isPrimary: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive","delete","maintenance"], default: "active" },
    capacity: { type: String },
    manager: { type: String },
    contactNumber: { type: String },
    auditLogs: [auditLogSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
  },
  { timestamps: true }
);
godownSchema.pre("validate", async function (next) {
  try {
    if (this.code) return next();

    const Counter = mongoose.model("Counter");

    const counter = await Counter.findOneAndUpdate(
      {
        clientId: this.clientId || this.client,
        companyId: this.companyId || this.company,
        type: "Godown",
      },
      { $inc: { seq: 1 } },
      {
        new: true,
        upsert: true,
      }
    );

    this.code = counter.seq.toString().padStart(6, "0");

    next();
  } catch (error) {
    next(error);
  }
});
godownSchema.index({ client: 1, company: 1, status: 1, createdAt: -1 });
godownSchema.index({ code: 1 }, { unique: true });
godownSchema.index({ name: "text", city: "text", address: "text", manager: "text" });
godownSchema.index({ company: 1, status: 1 });


godownSchema.index({ status: 1 });

godownSchema.index({ createdBy: 1 });

// godownSchema.index({ city: 1, state: 1, country: 1 });

godownSchema.index({ company: 1, isPrimary: 1 });

godownSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("Godown", godownSchema);
