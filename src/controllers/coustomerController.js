const Customer = require('../models/Customer');
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { generateUniqueId } = require('../utils/generate16DigiId');

// 🟢 Create Customer
exports.createCustomer = asyncHandler(async (req, res) => {
  const {
    customerName,
    
    
    emailAddress,
    phoneNumber,
    companyID, // company reference
    ...rest
  } = req.body;

  if (!customerName) {
    throw new ApiError(400, "Customer name and code are required");
  }
  const clientId =req.user.clientAgent ;

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
  console.log(req.files,req.body,"req,files")

  // Registration docs files
  if (req?.files?.['registrationDocs']) {
    registrationDocs = req.files['registrationDocs'].map(file => ({
      type: req.body.docType || 'Other',
      file: file.location,
      fileName: file.originalname
    }));
  }
  let code=await generateUniqueId(Customer,"code")

  const customer = await Customer.create({
    customerName,
    code,
    clientId,
    emailAddress,
    phoneNumber,
   
   
    companyID,
    ...rest,
    logo: logoUrl || "",
    registrationDocs: registrationDocs || [],
    banks:JSON.parse(req.body.banks),
    company:companyID
  });

  res
    .status(201)
    .json(new ApiResponse(201, customer, "Customer created successfully"));
});

// 🟢 Update Customer
exports.updateCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const customer = await Customer.findById(id);
  if (!customer) throw new ApiError(404, "Customer not found");

  let logoUrl = customer.logo;
  let registrationDocs = customer.registrationDocs;

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

  const updatedCustomer = await Customer.findByIdAndUpdate(
    id,
    { ...req.body, logo: logoUrl, registrationDocs },
    { new: true }
  );

  res
    .status(200)
    .json(new ApiResponse(200, updatedCustomer, "Customer updated successfully"));
});

// 🟢 Get All Customers (for a company)
exports.getCustomersByCompany = asyncHandler(async (req, res) => {
  const { companyId } = req.query;

  if (!companyId) throw new ApiError(400, "Company ID is required");

  const customers = await Customer.find({ company: companyId }).populate("company");

  res
    .status(200)
    .json(new ApiResponse(200, customers, "Customers fetched successfully"));
});
exports.getCustomersByClient = asyncHandler(async (req, res) => {
  // const { companyId } = req.query;

  const clientAgent =req.user.clientAgent ;
  console.log(req,"req.userrrr")


  

  if (!clientAgent) throw new ApiError(400, "ClientId ID is required");

  const customers = await Customer.find({ clientId: clientAgent });

  res
    .status(200)
    .json(new ApiResponse(200, customers, "Customers fetched successfully"));
});

// 🟢 Get Single Customer
exports.getCustomerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const customer = await Customer.findById(id).populate("company");
  if (!customer) throw new ApiError(404, "Customer not found");

  res
    .status(200)
    .json(new ApiResponse(200, customer, "Customer fetched successfully"));
});
