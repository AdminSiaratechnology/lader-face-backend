const Customer = require('../models/Customer');
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { generateUniqueId } = require('../utils/generate16DigiId');
const mongoose = require('mongoose');
const User = require('../models/User');
const   {createAuditLog}=require("../utils/createAuditLog")



// safe JSON parse
const safeParse = (value, fallback) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : value || fallback;
  } catch {
    return fallback;
  }
};
const insertInBatches = async (data, batchSize = 1000) => {
  let allInserted = [];
  if (data.length === 0) return allInserted;

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    try {
      const inserted = await Customer.insertMany(batch, { ordered: false });
      allInserted = allInserted.concat(inserted);
    } catch (err) {
      console.error("⚠️ Partial insert error:", err.message);
      // Continue inserting other batches
    }
  }

  return allInserted;
};


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
    let registrationDocTypes;
    try {
      registrationDocTypes = JSON.parse(req.body.registrationDocTypes || '[]');
    } catch (e) {
      console.error('Failed to parse registrationDocTypes:', e);
      registrationDocTypes = [];
    }

    if (req?.files?.['registrationDocs']) {
      registrationDocs = req?.files['registrationDocs'].map((file, index) => ({
        type: registrationDocTypes[index] || 'Other',
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
    company:companyID,
     createdBy: adminId,
         auditLogs: [
              {
                action: "create",
                performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
                timestamp: new Date(),
                details: "customer created",
              },
            ],
  });
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  
  console.log(ipAddress, "ipaddress");
    await createAuditLog({
    module: "customer",
    action: "create",
    performedBy: adminId,
    referenceId: customer._id,
    clientId,
    details: "Customer created successfully",
    ipAddress,
  });

  res
    .status(201)
    .json(new ApiResponse(201, customer, "Customer created successfully"));
});
// batch insert helper


exports.createBulkCustomers = asyncHandler(async (req, res) => {
  const { customers } = req.body;

  if (!Array.isArray(customers) || customers.length === 0) {
    throw new ApiError(400, "Customers array is required in body");
  }

  // ✅ Validate user
  const userId = req.user.id;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  const clientId = req.user.clientID;
  // const clientId = "68e4c05943e6b05c02e8f951";

  // ✅ Preload company IDs
  const companies = await Company.find({}, "_id");
  const validCompanyIds = new Set(companies.map((c) => String(c._id)));

  const results = [];
  const errors = [];

  for (const [index, body] of customers.entries()) {
    try {
      // Required fields
      if (!body.customerName || !body.company) {
        throw new Error("customerName and company are required");
      }
      if (!validCompanyIds.has(String(body.company))) {
        throw new Error("Invalid company ID");
      }

      const customerObj = {
        ...body,
        clientId,
        createdBy: userId,
        auditLogs: [
          {
            action: "create",
            performedBy: new mongoose.Types.ObjectId(userId),
            timestamp: new Date(),
            details: "Bulk customer import",
          },
        ],
      };

      results.push(customerObj);
    } catch (err) {
      errors.push({
        index,
        customerName: body?.customerName,
        code: body?.code,
        error: err.message,
      });
    }
  }

  // ✅ Batch insert
  const inserted = await insertInBatches(results, 1000);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        totalReceived: customers.length,
        totalInserted: inserted.length,
        totalFailed: errors.length,
        insertedIds: inserted.map((c) => c._id),
        errors,
      },
      "Bulk customer import completed successfully"
    )
  );
});

// 🟢 Update Customer
exports.updateCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const customer = await Customer.findById(id);
  if (!customer) throw new ApiError(404, "Customer not found");

  let logoUrl = customer.logo;
  let registrationDocs = customer.registrationDocs;
  let banks = customer.banks;

  // ✅ Replace logo if new one uploaded
  if (req?.files?.['logo'] && req?.files?.['logo'][0]) {
    logoUrl = req.files['logo'][0].location;
  }

  // ✅ Replace registration docs if new ones uploaded
  if (req?.files?.['registrationDocs']) {
    registrationDocs = req.files['registrationDocs'].map(file => ({
      type: req.body.docType || 'Other',
      file: file.location,
      fileName: file.originalname
    }));
  }

  // ✅ Prepare updateData
  const updateData = { 
    ...req.body, 
    logo: logoUrl, 
    registrationDocs 
  };

  // ✅ Remove password if not given
  if (!req.body.password) {
    delete updateData.password;
  }

  // ✅ Safely parse banks
  if (req.body.banks) {
    try {
      banks = typeof req.body.banks === "string" ? JSON.parse(req.body.banks) : req.body.banks;
      updateData.banks = banks;
    } catch (err) {
      throw new ApiError(400, "Invalid banks data");
    }
  }

  // ✅ Track changes before update
  const oldData = customer.toObject();
  const changes = {};

  Object.keys(updateData).forEach((key) => {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(updateData[key])) {
      changes[key] = { from: oldData[key], to: updateData[key] };
    }
  });

  // ✅ Prevent overwriting auditLogs
  if (updateData.auditLogs) {
    delete updateData.auditLogs;
  }

  // ✅ Apply updates safely
  for (const key in updateData) {
    customer[key] = updateData[key];
  }

  // ✅ Add audit log entry
  customer.auditLogs.push({
    action: "update",
    performedBy: req.user?.id || null,
    details: "Customer updated",
    changes,
  });

  await customer.save();
    let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "customer",
    action: "update",
    performedBy: req.user.id,
    referenceId: customer._id,
    clientId: req.user.clientID,
    details: "Customer updated successfully",
    changes,
    ipAddress,
  });

  res
    .status(200)
    .json(new ApiResponse(200, customer, "Customer updated successfully"));
});


// 🟢 Get All Customers (for a company)
exports.getCustomersByCompany = asyncHandler(async (req, res) => {
  const clientID = req.user.clientID;
  if (!clientID) throw new ApiError(400, "Client ID is required");
   const  {companyId} = req.params;
  if (!companyId) throw new ApiError(400, "company ID is required");
  

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
  // const filter = { clientId: clientID, status: { $ne: "Delete" } };
  console.log(companyId,"companyidddd")
  const filter = { clientId: clientID,company:companyId};
  if (status && status.trim() !== "") filter.status = status;
  console.log(search,"search","getCustomersByCompany")

  if (search && search.trim() !== "") {
    filter.$or = [
      { customerName: { $regex: search, $options: "i" } },
      { emailAddress: { $regex: search, $options: "i" } },
      { contactPerson: { $regex: search, $options: "i" } },
    ];
  }
  console.log(filter,"filter",search)

  // Sorting
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };
  console.log(filter,"filter");

  // Fetch data & total count
  const [customers, total] = await Promise.all([
    Customer.find(filter)
    .select("-auditLogs")
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
exports.getCustomersByClient = asyncHandler(async (req, res) => {
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
  // const filter = { clientId: clientID, status: { $ne: "Delete" } };
  const filter = { clientId: clientID};
  if (status && status.trim() !== "") filter.status = status;
  console.log(search,"search")

  if (search && search.trim() !== "") {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { contactNumber: { $regex: search, $options: "i" } },
    ];
  }
  console.log(filter,"filter")

  // Sorting
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };
  console.log(filter,"filter");

  // Fetch data & total count
  const [customers, total] = await Promise.all([
    Customer.find(filter)
    .select("-auditLogs")
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
  if (String(customer.clientId) !== String(req.user.clientID)) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  // soft delete
  customer.status = "Delete";
   customer.auditLogs.push({
        action: "delete",
        performedBy: new mongoose.Types.ObjectId(req.user.id),
        timestamp: new Date(),
        details: "Customer marked as deleted",
      });
  await customer.save();
    let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
    await createAuditLog({
    module: "customer",
    action: "delete",
    performedBy:  req.user.id,
    referenceId: customer._id,
    clientId: req.user.clientID,
    details: "Customer marked as deleted",
    ipAddress,
  });

  // send response
  res.status(200).json({
    success: true,
    message: "Customer deleted successfully",
    data: customer,
  });
});
