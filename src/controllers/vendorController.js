const Vendor = require('../models/Vendor');
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { generateUniqueId } = require('../utils/generate16DigiId');
const { json } = require('express');

// 🟢 Create Vendor
exports.createVendor = asyncHandler(async (req, res) => {
  const {
    vendorName,
    emailAddress,
    phoneNumber,
    companyID, // company reference
    ...rest
  } = req.body;

  if (!vendorName) {
    throw new ApiError(400, "Vendor name and code are required");
  }
  const clientId = req.user.clientAgent;

  // Company check
  // const existingCompany = await Company.findById(companyID);
  // if (!existingCompany) {
  //   throw new ApiError(404, "Company not found");
  // }

  let logoUrl = null;
  let registrationDocs = [];

  // Logo file
  if (req?.files?.['logo'] && req?.files?.['logo'][0]) {
    logoUrl = req.files['logo'][0].location;
  }
  // console.log(req.files,req.body,"req,files")

  // Registration docs files
  if (req?.files?.['registrationDocs']) {
    registrationDocs = req.files['registrationDocs'].map(file => ({
      type: req.body.docType || 'Other',
      file: file.location,
      fileName: file.originalname
    }));
  }
  let code = await generateUniqueId(Vendor, "code");
  console.log(JSON.parse(req.body.banks), "JSON.parse(req.body.banks)");

  const vendor = await Vendor.create({
    vendorName,
    code,
    clientId,
    emailAddress,
    phoneNumber,
    companyID,
    ...rest,
    logo: logoUrl || "",
    registrationDocs: registrationDocs || [],
    banks: JSON.parse(req.body.banks),
    company: companyID
  });

  res
    .status(201)
    .json(new ApiResponse(201, vendor, "Vendor created successfully"));
});

// 🟢 Update Vendor
exports.updateVendor = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vendor = await Vendor.findById(id);
  if (!vendor) throw new ApiError(404, "Vendor not found");

  let logoUrl = vendor.logo;
  let registrationDocs = vendor.registrationDocs;

  // Replace logo if new one uploaded
  if (req?.files?.['logo'] && req?.files?.['logo'][0]) {
    logoUrl = req.files['logo'][0].location;
  }

  // Replace registration docs if new ones uploaded
  if (req?.files?.['registrationDocs']) {
    registrationDocs = req.files['registrationDocs'].map(file => ({
      type: req.body.docType || 'Other',
      file: file.location,
      fileName: file.originalname
    }));
  }

  const updatedVendor = await Vendor.findByIdAndUpdate(
    id,
    { ...req.body, logo: logoUrl, registrationDocs, banks: JSON.parse(req.body.banks) },
    { new: true }
  );

  res
    .status(200)
    .json(new ApiResponse(200, updatedVendor, "Vendor updated successfully"));
});

// 🟢 Get All Vendors (for a company)
exports.getVendorsByCompany = asyncHandler(async (req, res) => {
  const { companyId } = req.query;

  if (!companyId) throw new ApiError(400, "Company ID is required");

  const vendors = await Vendor.find({ company: companyId }).populate("company");

  res
    .status(200)
    .json(new ApiResponse(200, vendors, "Vendors fetched successfully"));
});

exports.getVendorsByClient = asyncHandler(async (req, res) => {
  const clientAgent = req.user.clientAgent;
  console.log(req, "req.userrrr");

  if (!clientAgent) throw new ApiError(400, "ClientId ID is required");

  const vendors = await Vendor.find({ clientId: clientAgent, status: { $ne: "Delete" } });

  res
    .status(200)
    .json(new ApiResponse(200, vendors, "Vendors fetched successfully"));
});

// 🟢 Get Single Vendor
exports.getVendorById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const vendor = await Vendor.findById(id).populate("company");
  if (!vendor) throw new ApiError(404, "Vendor not found");

  res
    .status(200)
    .json(new ApiResponse(200, vendor, "Vendor fetched successfully"));
});

// Delete Vendor
exports.deleteVendor = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // check if id is passed
  if (!id) {
    throw new ApiError(400, "Vendor ID is required");
  }

  // find vendor
  const vendor = await Vendor.findById(id);
  if (!vendor) {
    throw new ApiError(404, "Vendor not found");
  }

  // check permission
  if (String(vendor.clientId) !== String(req.user.clientAgent)) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  // soft delete
  vendor.status = "Delete";
  await vendor.save();

  // send response
  res.status(200).json({
    success: true,
    message: "Vendor deleted successfully",
    data: vendor,
  });
});
