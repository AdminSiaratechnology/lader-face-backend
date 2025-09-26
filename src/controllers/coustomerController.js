const Customer = require('../models/Customer');
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { generateUniqueId } = require('../utils/generate16DigiId');
const { json } = require('express');

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
  // console.log(req.files,req.body,"req,files")

  // Registration docs files
  if (req?.files?.['registrationDocs']) {
    registrationDocs = req.files['registrationDocs'].map(file => ({
      type: req.body.docType || 'Other',
      file: file.location,
      fileName: file.originalname
    }));
  }
  let code=await generateUniqueId(Customer,"code")
  console.log(JSON.parse(req.body.banks),"JSON.parse(req.body.banks)")

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
    { ...req.body, logo: logoUrl, registrationDocs,banks:JSON.parse(req.body.banks), },
    { new: true },
    
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
  const clientAgent = req.user.clientAgent;
  if (!clientAgent) throw new ApiError(400, "Client ID is required");

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

  // Fetch data & total count
  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(perPage),
    Customer.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        customers,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      customers.length ? "Customers fetched successfully" : "No customers found"
    )
  );
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

//Delete Customer

exports.deleteCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // check if id is passed
  if (!id) {
    throw new ApiError(400, "Customer ID is required");
  }

  // find customer
  const customer = await Customer.findById(id);
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  // check permission
  if (String(customer.clientId) !== String(req.user.clientAgent)) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  // soft delete
  customer.status = "Delete";
  await customer.save();

  // send response
  res.status(200).json({
    success: true,
    message: "Customer deleted successfully",
    data: customer,
  });
});
