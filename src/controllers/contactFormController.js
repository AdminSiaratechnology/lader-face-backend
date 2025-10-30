const ContactForm = require("../models/contactFormModel");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const ApiError = require("../utils/apiError");

// 📝 POST: Create new contact form submission
exports.createContactForm = asyncHandler(async (req, res) => {
  const { name, company, email, phone, requirement,type } = req.body;

  if ( !email ) {
    throw new ApiError(400, " email requirement are required");
  }

  const newForm = await ContactForm.create({
    name,
    company,
    email,
    phone,
    requirement,
    type
  });

  res
    .status(201)
    .json(new ApiResponse(201, newForm, "Contact form submitted successfully"));
});

// 📄 GET: Get all submissions (for dashboard/admin)
exports.getAllContactForms = asyncHandler(async (req, res) => {
  const forms = await ContactForm.find().sort({ createdAt: -1 });
  res
    .status(200)
    .json(new ApiResponse(200, forms, "All contact forms fetched successfully"));
});

// 🧾 GET: Get single submission by ID
exports.getContactFormById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const form = await ContactForm.findById(id);

  if (!form) throw new ApiError(404, "Contact form not found");

  res
    .status(200)
    .json(new ApiResponse(200, form, "Contact form fetched successfully"));
});

// 🗑️ DELETE: Delete submission
exports.deleteContactForm = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await ContactForm.findByIdAndDelete(id);

  if (!deleted) throw new ApiError(404, "Contact form not found");

  res
    .status(200)
    .json(new ApiResponse(200, null, "Contact form deleted successfully"));
});
