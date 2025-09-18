const mongoose = require("mongoose");

const godownSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Client role wala user
      required: true,
    },
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    parent: { type: String },
    address: { type: String },
    state: { type: String },
    city: { type: String },
    country: { type: String },
    isPrimary: { type: Boolean, default: false },
    status: { type: String, enum: ["Active", "Inactive","Delete","Maintenance"], default: "Active" },
    capacity: { type: String },
    manager: { type: String },
    contactNumber: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Godown", godownSchema);
