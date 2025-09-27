
const Ledger = require('../models/Ladger')
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { generateUniqueId } = require('../utils/generate16DigiId');


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
  const clientId = req.user.clientAgent;

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
    company: companyID
  });

  res
    .status(201)
    .json(new ApiResponse(201, ledger, "Ledger created successfully"));
});

// 🟢 Update Ledger
exports.updateLedger = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ledger = await Ledger.findById(id);
  if (!ledger) throw new ApiError(404, "Ledger not found");

  let logoUrl = ledger.logo;
  let registrationDocs = ledger.registrationDocs;

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

  const updatedLedger = await Ledger.findByIdAndUpdate(
    id,
    { ...req.body, logo: logoUrl, registrationDocs, banks: JSON.parse(req.body.banks) },
    { new: true }
  );

  res
    .status(200)
    .json(new ApiResponse(200, updatedLedger, "Ledger updated successfully"));
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
  const clientAgent = req.user.clientAgent;
  if (!clientAgent) throw new ApiError(400, "ClientId is required");

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
  const filter = { clientId: clientAgent, status: { $ne: "Delete" } };
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
  if (String(ledger.clientId) !== String(req.user.clientAgent)) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  // Soft delete
  ledger.status = "Delete";
  await ledger.save();

  // Send response
  res.status(200).json({
    success: true,
    message: "Ledger deleted successfully",
    data: ledger,
  });
});