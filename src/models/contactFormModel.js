const mongoose = require("mongoose");

const contactFormSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["subscriber", "enquiry"],
      default: "enquiry", // default type if not provided
    },
    name: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    phone: {
      type: String,
      trim: true,
    },
    requirement: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ContactForm", contactFormSchema);
