const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    code: { type: String, required: true, unique: true },

    description: { type: String },

    sequence: { type: Number, unique: true },

    status: {
      type: String,
      enum: ["active", "inactive", "delete"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", ProjectSchema);
