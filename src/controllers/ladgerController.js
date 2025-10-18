
const Ledger = require('../models/Ladger')
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { generateUniqueId } = require('../utils/generate16DigiId');
const mongoose = require('mongoose');


// 🟢 Create Ledger
exports.createLedger = asyncHandler(async (req, res) => {
  const {
    ledgerName,
    emailAddress,
    phoneNumber,
    companyID, // company reference
    ...rest
  } = req.body;

  if (!ledgerName) {
    throw new ApiError(400, "Ledger name and code are required");
  }
  const clientId = req.user.clientID;

  let logoUrl = null;
  let registrationDocs = [];

  // Logo file
  if (req?.files?.['logo'] && req?.files?.['logo'][0]) {
    logoUrl = req.files['logo'][0].location;
  }

  // Registration docs files
  if (req?.files?.['registrationDocs']) {
    registrationDocs = req.files['registrationDocs'].map(file => ({
      type: req.body.docType || 'Other',
      file: file.location,
      fileName: file.originalname
    }));
  }
  let ledgerCode = await generateUniqueId(Ledger, "ledgerCode");

  const ledger = await Ledger.create({
    ledgerName,
    ledgerCode,
    clientId,
    emailAddress,
    phoneNumber,
    companyID,
    ...rest,
    logo: logoUrl || "",
    registrationDocs: registrationDocs || [],
    banks: JSON.parse(req.body.banks),
    company: companyID,
    createdBy: req?.user?.id,
    auditLogs: [
      {
        action: "create",
        performedBy: new mongoose.Types.ObjectId(req.user.id),
        timestamp: new Date(),
        details: "Ledger created",
      },
    ],
  });

  res
    .status(201)
    .json(new ApiResponse(201, ledger, "Ledger created successfully"));
});

// 🟢 Update Ledger
exports.updateLedger = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ✅ Step 1: Find existing ledger
  const ledger = await Ledger.findById(id);
  if (!ledger) throw new ApiError(404, "Ledger not found");

  let logoUrl = ledger.logo;
  let registrationDocs = ledger.registrationDocs;
  let banks = ledger.banks;

  // ✅ Step 2: Replace logo if new one uploaded
  if (req?.files?.["logo"] && req?.files?.["logo"][0]) {
    logoUrl = req.files["logo"][0].location;
  }

  // ✅ Step 3: Replace registration docs if new ones uploaded
  if (req?.files?.["registrationDocs"]) {
    registrationDocs = req.files["registrationDocs"].map((file) => ({
      type: req.body.docType || "Other",
      file: file.location,
      fileName: file.originalname,
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
      banks =
        typeof req.body.banks === "string"
          ? JSON.parse(req.body.banks)
          : req.body.banks;
      updateData.banks = banks;
    } catch (err) {
      throw new ApiError(400, "Invalid banks data");
    }
  }

  // ✅ Step 6: Track field changes before update
  const oldData = ledger.toObject();
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
    ledger[key] = updateData[key];
  }

  // ✅ Step 9: Push new audit log entry
  ledger.auditLogs.push({
    action: "update",
    performedBy: req.user?.id || null,
    details: "Ledger updated successfully",
    changes,
  });

  // ✅ Step 10: Save ledger document
  await ledger.save();

  res
    .status(200)
    .json(new ApiResponse(200, ledger, "Ledger updated successfully"));
});


// 🟢 Get All Ledgers (for a company)
exports.getLedgersByCompany = asyncHandler(async (req, res) => {
  const { companyId } = req.query;

  if (!companyId) throw new ApiError(400, "Company ID is required");

  const ledgers = await Ledger.find({ company: companyId }).populate("company");

  res
    .status(200)
    .json(new ApiResponse(200, ledgers, "Ledgers fetched successfully"));
});

// 🟢 Get All Ledgers (for a client)
exports.getLedgersByClient = asyncHandler(async (req, res) => {
  const clientID = req.user.clientID;
  if (!clientID) throw new ApiError(400, "ClientId is required");

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

  // Query
  const [ledgers, total] = await Promise.all([
    Ledger.find(filter).sort(sortOptions).skip(skip).limit(perPage),
    Ledger.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        ledgers,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      ledgers.length ? "Ledgers fetched successfully" : "No ledgers found"
    )
  );
});


// 🟢 Get Single Ledger
exports.getLedgerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ledger = await Ledger.findById(id).populate("company");
  if (!ledger) throw new ApiError(404, "Ledger not found");

  res
    .status(200)
    .json(new ApiResponse(200, ledger, "Ledger fetched successfully"));
});

// 🟢 Delete Ledger
exports.deleteLedger = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if id is passed
  if (!id) {
    throw new ApiError(400, "Ledger ID is required");
  }

  // Find ledger
  const ledger = await Ledger.findById(id);
  if (!ledger) {
    throw new ApiError(404, "Ledger not found");
  }

  // Check permission
  if (String(ledger.clientId) !== String(req.user.clientID)) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  // Soft delete
  ledger.status = "Delete";
  ledger.auditLogs.push({
              action: "delete",
              performedBy: new mongoose.Types.ObjectId(req.user.id),
              timestamp: new Date(),
              details: "Ledger marked as deleted",
            });
  await ledger.save();

  // Send response
  res.status(200).json({
    success: true,
    message: "Ledger deleted successfully",
    data: ledger,
  });
});