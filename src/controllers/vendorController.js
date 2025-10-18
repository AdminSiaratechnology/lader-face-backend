const Vendor = require('../models/Vendor');
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { generateUniqueId } = require('../utils/generate16DigiId');
const mongoose = require('mongoose');

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
  const clientId = req.user.clientID;
  const adminId = req?.user?.id;

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
    company: companyID,
        createdBy: adminId,
             auditLogs: [
                  {
                    action: "create",
                    performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
                    timestamp: new Date(),
                    details: "vendor created",
                  },
                ],
  });

  res
    .status(201)
    .json(new ApiResponse(201, vendor, "Vendor created successfully"));
});

// 🟢 Update Vendor
exports.updateVendor = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ✅ Step 1: Find existing vendor
  const vendor = await Vendor.findById(id);
  if (!vendor) throw new ApiError(404, "Vendor not found");

  let logoUrl = vendor.logo;
  let registrationDocs = vendor.registrationDocs;
  let banks = vendor.banks;

  // ✅ Step 2: Replace logo if new one uploaded
  if (req?.files?.['logo'] && req?.files?.['logo'][0]) {
    logoUrl = req.files['logo'][0].location;
  }

  // ✅ Step 3: Replace registration docs if new ones uploaded
  if (req?.files?.['registrationDocs']) {
    registrationDocs = req.files['registrationDocs'].map(file => ({
      type: req.body.docType || 'Other',
      file: file.location,
      fileName: file.originalname
    }));
  }

  // ✅ Step 4: Prepare updateData
  const updateData = {
    ...req.body,
    logo: logoUrl,
    registrationDocs,
  };

  // ✅ Step 5: Safely parse banks
  if (req.body.banks) {
    try {
      banks = typeof req.body.banks === "string" ? JSON.parse(req.body.banks) : req.body.banks;
      updateData.banks = banks;
    } catch (err) {
      throw new ApiError(400, "Invalid banks data");
    }
  }

  // ✅ Step 6: Track field changes before update
  const oldData = vendor.toObject();
  const changes = {};

  Object.keys(updateData).forEach((key) => {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(updateData[key])) {
      changes[key] = { from: oldData[key], to: updateData[key] };
    }
  });

  // ✅ Step 7: Prevent auditLogs overwrite
  if (updateData.auditLogs) {
    delete updateData.auditLogs;
  }

  // ✅ Step 8: Apply updates safely
  for (const key in updateData) {
    vendor[key] = updateData[key];
  }

  // ✅ Step 9: Push new audit log entry
  vendor.auditLogs.push({
    action: "update",
    performedBy: req.user?.id || null,
    details: "Vendor updated successfully",
    changes,
  });

  // ✅ Step 10: Save vendor document
  await vendor.save();

  res
    .status(200)
    .json(new ApiResponse(200, vendor, "Vendor updated successfully"));
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
  const clientID = req.user.clientID;
  if (!clientID) throw new ApiError(400, "Client ID is required");

  const {
    search = "",
    status = "",
    sortBy = "name",
    sortOrder = "asc",
    page = 1,
    limit = 10,
  } = req.query;

  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;

  // Filter
  const filter = { clientId: clientID, status: { $ne: "Delete" } };
  if (status && status.trim() !== "") filter.status = status;

  if (search && search.trim() !== "") {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { contactNumber: { $regex: search, $options: "i" } },
    ];
  }

  // Sorting
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };

  // Fetch data & total count
  const [vendors, total] = await Promise.all([
    Vendor.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(perPage),
    Vendor.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        vendors,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      vendors.length ? "Vendors fetched successfully" : "No vendors found"
    )
  );
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
  if (String(vendor.clientId) !== String(req.user.clientID)) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  // soft delete
  vendor.status = "Delete";
   vendor.auditLogs.push({
          action: "delete",
          performedBy: new mongoose.Types.ObjectId(req.user.id),
          timestamp: new Date(),
          details: "Vendor marked as deleted",
        });
  
  await vendor.save();

  // send response
  res.status(200).json({
    success: true,
    message: "Vendor deleted successfully",
    data: vendor,
  });
});
