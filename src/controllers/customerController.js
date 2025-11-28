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
    console.log(req.body,"resssss")

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

  // 1. Basic Validation
  if (!Array.isArray(customers) || customers.length === 0) {
    throw new ApiError(400, "Customers array is required in body");
  }

  const userId = req.user.id;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  const clientId = req.user.clientID;

  // 2. Group Customers by Company ID
  // We do this to generate codes efficiently per company
  const customersByCompany = {};
  
  // Also validate company IDs exist
  const allCompanies = await Company.find({}, "_id");
  const validCompanyIds = new Set(allCompanies.map((c) => String(c._id)));

  const formattingErrors = [];
  const validCustomersToInsert = [];

  // Step 2.1: Pre-process and Group
  customers.forEach((body, index) => {
    try {
      if (!body.customerName || !body.company) {
        throw new Error("Missing required fields: customerName or company");
      }
      if (!validCompanyIds.has(String(body.company))) {
        throw new Error(`Invalid company ID: ${body.company}`);
      }

      // Grouping logic
      const compId = String(body.company);
      if (!customersByCompany[compId]) {
        customersByCompany[compId] = [];
      }

      // Add index to track back errors later
      customersByCompany[compId].push({ ...body, originalIndex: index });

    } catch (err) {
      formattingErrors.push({
        index,
        customerName: body?.customerName || "Unknown",
        error: err.message,
      });
    }
  });

  // 3. Generate Codes in Memory (Fixing the Race Condition)
  for (const compId of Object.keys(customersByCompany)) {
    const batch = customersByCompany[compId];

    // Find the LAST code currently in DB for this company
    // We sort by 'code' (descending) to get the highest number
    // Note: We cast code to integer for sorting if stored as string, 
    // but usually string sort works if padding is consistent.
    // Ideally, sort by createdAt or code.
    const lastCustomer = await Customer.findOne({ 
      company: compId,
      code: { $exists: true } 
    }).sort({ createdAt: -1, code: -1 }).select("code");

    let currentCodeNum = 0;
    if (lastCustomer && lastCustomer.code) {
      const parsed = parseInt(lastCustomer.code, 10);
      if (!isNaN(parsed)) currentCodeNum = parsed;
    }

    // Assign new codes to this batch
    batch.forEach((custData) => {
      currentCodeNum++; 
      // Pad with zeros (e.g., 000000000012)
      const newCode = currentCodeNum.toString().padStart(12, "0");

      const customerObj = {
        ...custData,
        code: newCode, // Manually assigning code here!
        clientId,
        createdBy: userId,
        // Force lowercase status to avoid Enum errors
        status: custData.status ? custData.status.toLowerCase() : "active",
        auditLogs: [
          {
            action: "create",
            performedBy: userId,
            timestamp: new Date(),
            details: "Bulk customer import",
          },
        ],
      };
      
      // Remove temporary key before pushing
      const { originalIndex, ...finalObj } = customerObj;
      
      // We store originalIndex separately to map errors back if DB fails
      // But for insertMany, we pass the clean object
      // We attach originalIndex to the object prototype or manage mapping via order
      // Simpler approach: Just push to valid list, but if write fails, 
      // we might lose exact index mapping if we don't handle it carefully.
      // For now, we will assume sequential processing for mapping.
      
      // Actually, to map errors correctly, we need to know the original index.
      // We can attach it as a temporary field and use 'strict: false' or remove it?
      // Mongoose ignores unknown fields if strict is true. Let's rely on that.
      validCustomersToInsert.push({ ...finalObj, _tempIndex: custData.originalIndex });
    });
  }

  // If no valid customers, return errors
  if (validCustomersToInsert.length === 0) {
    return res.status(400).json(
      new ApiResponse(400, { errors: formattingErrors }, "No valid customers to process")
    );
  }

  let finalInsertedCount = 0;
  const dbErrors = [];

  // 4. Bulk Insert
  try {
    const result = await Customer.insertMany(validCustomersToInsert, { 
      ordered: false, // Continue even if one fails
      rawResult: true 
    });
    
    // Mongoose 5/6/7 differences in result structure
    finalInsertedCount = result.insertedCount || result.length || 0;

  } catch (error) {
    
    // A. Handle successes in partial failure
    if (error.insertedDocs) {
      finalInsertedCount = error.insertedDocs.length;
    }

    // B. Handle Write Errors (Duplicates, etc)
    if (error.writeErrors) {
      error.writeErrors.forEach((e) => {
        // e.index corresponds to the index in 'validCustomersToInsert'
        const failedItem = validCustomersToInsert[e.index];
        const realIndex = failedItem._tempIndex; // Retrieve the original JSON index

        // Better Error Message Extraction
        let errMsg = "Unknown DB Error";
        if (e.errmsg) errMsg = e.errmsg;
        else if (e.message) errMsg = e.message;

        // Check for specific Duplicate Key Error (Code 11000)
        if (e.code === 11000) {
            // Check which field is duplicate
            if (errMsg.includes("emailAddress")) {
                errMsg = `Duplicate Email: ${failedItem.emailAddress} already exists.`;
            } else if (errMsg.includes("code")) {
                errMsg = `Duplicate Code generated: ${failedItem.code}. Please retry.`;
            } else {
                errMsg = "Duplicate entry found.";
            }
        }

        dbErrors.push({
          index: realIndex, 
          customerName: failedItem.customerName,
          code: failedItem.code,
          error: errMsg,
        });
      });
    }
    
    // C. Handle Validation Errors
    else if (error.name === "ValidationError") {
       dbErrors.push({
         index: "N/A",
         error: "Validation Error: " + error.message
       });
    }
  }

  const allErrors = [...formattingErrors, ...dbErrors];
  // Sort errors by index for readability
  allErrors.sort((a, b) => a.index - b.index);

  const statusCode = allErrors.length > 0 && finalInsertedCount === 0 ? 400 : 201;

  res.status(statusCode).json(
    new ApiResponse(
      statusCode,
      {
        totalReceived: customers.length,
        totalInserted: finalInsertedCount,
        totalFailed: allErrors.length,
        errors: allErrors,
      },
      allErrors.length > 0 
        ? `Import finished with ${allErrors.length} errors` 
        : "Bulk customer import completed successfully"
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
// exports.getCustomersByCompany = asyncHandler(async (req, res) => {
//   const clientID = req.user.clientID;
//   if (!clientID) throw new ApiError(400, "Client ID is required");
//   const user=User.findById(req.user.id);


//   const { companyId } = req.params;
//   if (!companyId) throw new ApiError(400, "company ID is required");

//   const {
//     search = "",
//     status = "",
//     sortBy = "createdAt",
//     sortOrder = "desc",
//     page = 1,
//     limit = 10,
//     isCustomer=false
//   } = req.query;

//   const perPage = parseInt(limit, 10);
//   const currentPage = Math.max(parseInt(page, 10), 1);
//   const skip = (currentPage - 1) * perPage;

//   const filter = {
//     clientId: clientID,
//     company: companyId,
//     status: { $ne: "delete" },
//   };

//   if (status && status.trim() !== "") filter.status = status;

//   if (search && search.trim() !== "") {
//     filter.$or = [
//       { customerName: { $regex: search, $options: "i" } },
//       { emailAddress: { $regex: search, $options: "i" } },
//       { contactPerson: { $regex: search, $options: "i" } },
//     ];
//   }

//   const sortDirection = sortOrder === "asc" ? 1 : -1;
//   const sortOptions = { [sortBy]: sortDirection };

//   // 🔥 Get paginated customers + total
//   const [customers, total] = await Promise.all([
//     Customer.find(filter)
//       .select("-auditLogs")
//       .populate({ path: "agent", select: "agentName" })
//       .sort(sortOptions)
//       .skip(skip)
//       .limit(perPage),

//     Customer.countDocuments(filter),
//   ]);

//   // 🔥 NEW — special counts (full company-level count, not filtered)
//   const [
//     gstRegistered,
//     msmeRegistered,
//     activeCustomers,
//     vatRegistered
//   ] = await Promise.all([
//     Customer.countDocuments({
//       clientId: clientID,
//       company: companyId,
//       status: { $ne: "delete" },
//       gstNumber: { $exists: true, $ne: "" }
//     }),

//     Customer.countDocuments({
//       clientId: clientID,
//       company: companyId,
//       status: { $ne: "delete" },
//       msmeRegistration: { $exists: true, $ne: "" }
//     }),

//     Customer.countDocuments({
//       clientId: clientID,
//       company: companyId,
//       status: "active"
//     }),

//     Customer.countDocuments({
//       clientId: clientID,
//       company: companyId,
//       status: { $ne: "delete" },
//       vatNumber: { $exists: true, $ne: "" }
//     }),
//   ]);

//   res.status(200).json(
//     new ApiResponse(
//       200,
//       {
//         customers,
//         pagination: {
//           total,
//           page: currentPage,
//           limit: perPage,
//           totalPages: Math.ceil(total / perPage),
//         },
//         counts: {
//           gstRegistered,
//           msmeRegistered,
//           activeCustomers,
//           vatRegistered
//         }
//       },
//       customers.length ? "Customers fetched successfully" : "No customers found"
//     )
//   );
// });

// exports.getCustomersByCompany = asyncHandler(async (req, res) => {
//   const clientID = req.user.clientID;
//   if (!clientID) throw new ApiError(400, "Client ID is required");

//   const user = await User.findById(req.user.id);
//   if (!user) throw new ApiError(404, "User not found");

//   const { companyId } = req.params;
//   if (!companyId) throw new ApiError(400, "Company ID is required");

//   const {
//     search = "",
//     status = "",
//     sortBy = "createdAt",
//     sortOrder = "desc",
//     page = 1,
//     limit = 10,
//     isCustomer = false,
//   } = req.query;

//   const perPage = parseInt(limit, 10);
//   const currentPage = Math.max(parseInt(page, 10), 1);
//   const skip = (currentPage - 1) * perPage;

//   // 🔥 Base filter
//   const filter = {
//     clientId: clientID,
//     company: companyId,
//     status: { $ne: "delete" },
//   };

//   // 🟦 If specific status requested
//   if (status && status.trim() !== "") filter.status = status;

//   // 🟦 Search filter
//   if (search && search.trim() !== "") {
//     filter.$or = [
//       { customerName: { $regex: search, $options: "i" } },
//       { emailAddress: { $regex: search, $options: "i" } },
//       { contactPerson: { $regex: search, $options: "i" } },
//     ];
//   }

//   // 🟦 Sorting
//   const sortDirection = sortOrder === "asc" ? 1 : -1;
//   const sortOptions = { [sortBy]: sortDirection };

//   // **********************************************************************
//   // 🔥 isCustomer = true → Filter customers only allowed to this salesman
//   // **********************************************************************
//   if (isCustomer === "true" || isCustomer === true) {
//     // find access for this company
//     const accessForCompany = user.access.find(
//       (acc) => String(acc.company?._id) === String(companyId)
//     );

//     if (!accessForCompany) {
//       return res.status(200).json(
//         new ApiResponse(200, {
//           customers: [],
//           pagination: {
//             total: 0,
//             page: currentPage,
//             limit: perPage,
//             totalPages: 0,
//           },
//           counts: {
//             gstRegistered: 0,
//             msmeRegistered: 0,
//             activeCustomers: 0,
//             vatRegistered: 0,
//           },
//         }, "No customers found for this salesman")
//       );
//     }

//     // extract customerGroup IDs from access
//     const allowedGroups = accessForCompany.customerGroups.map(
//       (g) => g.groupId
//     );

//     // add filter
//     filter.customerGroup = { $in: allowedGroups };
//   }

//   // **********************************************************************

//   // Fetch paginated customers
//   const [customers, total] = await Promise.all([
//     Customer.find(filter)
//       .select("-auditLogs")
//       .populate({ path: "agent", select: "agentName" })
//       .sort(sortOptions)
//       .skip(skip)
//       .limit(perPage),

//     Customer.countDocuments(filter),
//   ]);

//   // 🔥 Company level special counts
//   const [
//     gstRegistered,
//     msmeRegistered,
//     activeCustomers,
//     vatRegistered
//   ] = await Promise.all([
//     Customer.countDocuments({
//       clientId: clientID,
//       company: companyId,
//       status: { $ne: "delete" },
//       gstNumber: { $exists: true, $ne: "" },
//     }),

//     Customer.countDocuments({
//       clientId: clientID,
//       company: companyId,
//       status: { $ne: "delete" },
//       msmeRegistration: { $exists: true, $ne: "" },
//     }),

//     Customer.countDocuments({
//       clientId: clientID,
//       company: companyId,
//       status: "active",
//     }),

//     Customer.countDocuments({
//       clientId: clientID,
//       company: companyId,
//       status: { $ne: "delete" },
//       vatNumber: { $exists: true, $ne: "" },
//     }),
//   ]);

//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       {
//         customers,
//         pagination: {
//           total,
//           page: currentPage,
//           limit: perPage,
//           totalPages: Math.ceil(total / perPage),
//         },
//         counts: {
//           gstRegistered,
//           msmeRegistered,
//           activeCustomers,
//           vatRegistered,
//         },
//       },
//       customers.length
//         ? "Customers fetched successfully"
//         : "No customers found"
//     )
//   );
// });
exports.getCustomersByCompany = asyncHandler(async (req, res) => {
  const clientID = req.user.clientID;
  if (!clientID) throw new ApiError(400, "Client ID is required");

  // 🔥 Fix 1: Yahan 'await' lagana zaroori hai user data fetch karne ke liye
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  const { companyId } = req.params;
  if (!companyId) throw new ApiError(400, "company ID is required");

  const {
    search = "",
    status = "",
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 10,
    isCustomer = false // String "true" or "false" usually comes from query
  } = req.query;
  console.log(req.query,"isCustomer")

  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;

  // Base Filter
  const filter = {
    clientId: clientID,
    company: companyId,
    status: { $ne: "delete" },
  };

  // 🔥 Fix 2: User Access Logic Implementation
  // Agar isCustomer true hai, tabhi ye access check chalega
  if (isCustomer === "true" || isCustomer === true) {
    
    // 1. User ke access array mein se current company find karo
    // Note: Hum toString() use kar rahe hain taaki ID type mismatch na ho
    const companyAccess = user.access.find(
      (acc) => 
        (acc.company._id && acc.company._id.toString() === companyId.toString()) || 
        (acc.company.toString() === companyId.toString())
    );

    // 2. Check karo agar access mila aur usme customerGroups define hain
    if (companyAccess && companyAccess.customerGroups && companyAccess.customerGroups.length > 0) {
      
      // User ke allowed group IDs nikalo
      const allowedGroupIds = companyAccess.customerGroups.map(g => g.groupId);
      
      // Filter mein add karo: Customer ka group inn allowed IDs mein se ek hona chahiye
      filter.customerGroup = { $in: allowedGroupIds };
      
    } 
    // Else: Agar customerGroups empty hai ([]), toh hum filter mein kuch add nahi karenge.
    // Iska matlab automatically "Show All Customers" ho jayega.
  }

  // --- Baaki purana logic same rahega ---

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

  // 🔥 Counts Logic (Yeh filter use nahi karega, yeh company level total hai)
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
