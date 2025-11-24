const Customer = require("../models/Customer");
const Company = require("../models/Company");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const { generateUniqueId } = require("../utils/generate16DigiId");
const mongoose = require("mongoose");
const User = require("../models/User");
const { createAuditLog } = require("../utils/createAuditLog");
const processRegistrationDocs = require("../utils/processRegistrationDocs");

//  safe JSON parse_
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
    }
  }

  return allInserted;
};

exports.createCustomer = asyncHandler(async (req, res) => {
  try {
    const {
      customerName,
      emailAddress,
      phoneNumber,
      companyID,
      registrationDocTypes: rawDocTypes,
      ...rest
    } = req.body;

    const adminId = req?.user?.id;
    const clientId = req.user.clientID;

    if (!customerName) {
      throw new ApiError(400, "Customer name is required");
    }
    if (!clientId) {
      throw new ApiError(400, "Client ID is required from token");
    }

 

    // Parallel file processing
    const [logoUrl, processedDocs] = await Promise.all([
      req.files?.logo?.[0]?.location || null,
      processRegistrationDocs(req.files?.registrationDocs || [], rawDocTypes),
    ]);

    const code = await generateUniqueId(Customer, "code");

    let banks = [];
    if (req.body.banks) {
      try {
        banks =
          typeof req.body.banks === "string"
            ? JSON.parse(req.body.banks)
            : req.body.banks;
      } catch (err) {
        throw new ApiError(400, "Invalid banks data format");
      }
    }

    const customer = await Customer.create({
      customerName,
      code,
      clientId,
      emailAddress,
      phoneNumber,
      companyID,
      ...rest,
      logo: logoUrl || "",
      registrationDocs: processedDocs,
      banks,
      company: companyID,
      createdBy: adminId,
      auditLogs: [
        {
          action: "create",
          performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
          timestamp: new Date(),
          details: "Customer created",
        },
      ],
    });

    // Capture IP Address
    let ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;
    if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
      ipAddress = "127.0.0.1";
    }

    // ✅ Run audit log creation in background (non-blocking)
    Promise.resolve(
      createAuditLog({
        module: "Customer",
        action: "create",
        performedBy: req.user.id,
        referenceId: customer._id,
        clientId,
        details: "Customer created successfully",
        ipAddress,
      })
    ).catch((err) => {
      console.error("Audit log creation failed:", err.message);
    });

    const safeCustomer=customer.toObject();
delete safeCustomer.auditLogs

    return res
      .status(201)
      .json(new ApiResponse(201, safeCustomer, "Customer created successfully"));
  } catch (error) {
    // Handle Duplicate Key Error
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyValue)[0];
      const duplicateValue = error.keyValue[duplicateField];
      return res.status(400).json(
        new ApiResponse(
          400,
          null,
          `Duplicate value found: ${duplicateField} '${duplicateValue}' already exists. Please use a different value.`
        )
      );
    }

    // Other unexpected errors
    throw error;
  }
});
// batch insert helper_

exports.createBulkCustomers = asyncHandler(async (req, res) => {
  const { customers } = req.body;

  if (!Array.isArray(customers) || customers.length === 0) {
    throw new ApiError(400, "Customers array is required in body");
  }
  const userId = req.user.id;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  const clientId = req.user.clientID;

  const companies = await Company.find({}, "_id");
  const validCompanyIds = new Set(companies.map((c) => String(c._id)));

  const results = [];
  const errors = [];

  for (const [index, body] of customers.entries()) {
    try {
      // Required fields_
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
  // ✅ Batch insert_
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

exports.updateCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const customer = await Customer.findById(id);
  if (!customer) throw new ApiError(404, "Customer not found");
  const { registrationDocTypes: rawDocTypes, ...rest } = req.body;

  const [logoUrl, processedNewDocs] = await Promise.all([
    req.files?.logo?.[0]?.location || null,
    processRegistrationDocs(req.files?.registrationDocs || [], rawDocTypes),
  ]);
  const updateData = { ...rest };

  if (logoUrl) {
    updateData.logo = logoUrl;
  }

  if (req.body.banks) {
    try {
      updateData.banks =
        typeof req.body.banks === "string"
          ? JSON.parse(req.body.banks)
          : req.body.banks;
    } catch {
      throw new ApiError(400, "Invalid banks JSON");
    }
  }

  if (processedNewDocs.length > 0) {
    let parsedTypes = [];
    try {
      parsedTypes =
        typeof rawDocTypes === "string"
          ? JSON.parse(rawDocTypes)
          : rawDocTypes || [];
    } catch (e) {
      parsedTypes = [];
    }

    const existingDocs = (customer.registrationDocs || []).filter(
      (doc) => !parsedTypes.includes(doc.type)
    );

    const finalDocs = [...existingDocs];
    processedNewDocs.forEach((newDoc, idx) => {
      const type = parsedTypes[idx];
      if (type) {
        const existingIndex = finalDocs.findIndex((d) => d.type === type);
        if (existingIndex !== -1) {
          finalDocs[existingIndex] = newDoc;
        } else {
          finalDocs.push(newDoc);
        }
      }
    });

    updateData.registrationDocs = finalDocs;
  }

  const oldData = customer.toObject();
  const changes = {};
  Object.keys(updateData).forEach((key) => {
    if (key === "auditLogs") return;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(updateData[key])) {
      changes[key] = { from: oldData[key], to: updateData[key] };
    }
  });

  Object.keys(updateData).forEach((key) => {
    if (key !== "auditLogs") {
      customer[key] = updateData[key];
    }
  });
  if (!customer.auditLogs) customer.auditLogs = [];
  customer.auditLogs.push({
    action: "update",
    performedBy: new mongoose.Types.ObjectId(req.user.id),
    timestamp: new Date(),
    details: "Customer updated",
    changes,
  });
  await customer.save();
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }

  await createAuditLog({
    module: "Customer",
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

// 🟢 Get All Customers (for a company)_
exports.getCustomersByCompany = asyncHandler(async (req, res) => {
  const clientID = req.user.clientID;
  if (!clientID) throw new ApiError(400, "Client ID is required");

  const { companyId } = req.params;
  if (!companyId) throw new ApiError(400, "company ID is required");

  const {
    search = "",
    status = "",
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 10,
  } = req.query;

  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;

  const filter = {
    clientId: clientID,
    company: companyId,
    status: { $ne: "delete" },
  };

  if (status && status.trim() !== "") filter.status = status;

  if (search && search.trim() !== "") {
    filter.$or = [
      { customerName: { $regex: search, $options: "i" } },
      { emailAddress: { $regex: search, $options: "i" } },
      { contactPerson: { $regex: search, $options: "i" } },
    ];
  }

  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };

  // 🔥 Get paginated customers + total
  const [customers, total] = await Promise.all([
    Customer.find(filter)
      .select("-auditLogs")
      .populate({ path: "agent", select: "agentName" })
      .sort(sortOptions)
      .skip(skip)
      .limit(perPage),

    Customer.countDocuments(filter),
  ]);

  // 🔥 NEW — special counts (full company-level count, not filtered)
  const [
    gstRegistered,
    msmeRegistered,
    activeCustomers,
    vatRegistered
  ] = await Promise.all([
    Customer.countDocuments({
      clientId: clientID,
      company: companyId,
      status: { $ne: "delete" },
      gstNumber: { $exists: true, $ne: "" }
    }),

    Customer.countDocuments({
      clientId: clientID,
      company: companyId,
      status: { $ne: "delete" },
      msmeRegistration: { $exists: true, $ne: "" }
    }),

    Customer.countDocuments({
      clientId: clientID,
      company: companyId,
      status: "active"
    }),

    Customer.countDocuments({
      clientId: clientID,
      company: companyId,
      status: { $ne: "delete" },
      vatNumber: { $exists: true, $ne: "" }
    }),
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
        counts: {
          gstRegistered,
          msmeRegistered,
          activeCustomers,
          vatRegistered
        }
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
  // const filter = { clientId: clientID, status: { $ne: "Delete" } };_
  const filter = { clientId: clientID };
  if (status && status.trim() !== "") filter.status = status;
  console.log(search, "search");

  if (search && search.trim() !== "") {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { contactNumber: { $regex: search, $options: "i" } },
    ];
  }
  console.log(filter, "filter");
  // Sorting_
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };
  console.log(filter, "filter");

  // / Fetch data & total count_
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

// 🟢 Get Single Customer_
exports.getCustomerById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const customer = await Customer.findById(id).populate("company");
  if (!customer) throw new ApiError(404, "Customer not found");

  res
    .status(200)
    .json(new ApiResponse(200, customer, "Customer fetched successfully"));
});

exports.deleteCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new ApiError(400, "Customer ID is required");
  }
  // find customer_
  const customer = await Customer.findById(id);
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }
  // check permission_
  if (String(customer.clientId) !== String(req.user.clientID)) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }
  customer.status = "delete";
  customer.auditLogs.push({
    action: "delete",
    performedBy: new mongoose.Types.ObjectId(req.user.id),
    timestamp: new Date(),
    details: "Customer marked as deleted",
  });
  await customer.save();
  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress; // convert ::1 → 127.0.0.1_
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "customer",
    action: "delete",
    performedBy: req.user.id,
    referenceId: customer._id,
    clientId: req.user.clientID,
    details: "Customer marked as deleted",
    ipAddress,
  });

  // send response_
  res.status(200).json({
    success: true,
    message: "Customer deleted successfully",
    data: customer,
  });
});
