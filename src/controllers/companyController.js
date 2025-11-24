const Company = require("../models/Company");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const User = require("../models/User");
const { generate6DigitId } = require("../utils/newgenerate16DigiId");
const { generate6DigitUniqueId } = require("../utils/generate6DigitUniqueId");

const puppeteer = require("puppeteer");
const mongoose = require("mongoose");
// const { createAuditLog } = require("../utils/createAuditLog");
const createAuditLog  = require("../utils/createAuditLogMain");
const processRegistrationDocs = require("../utils/processRegistrationDocs");

const generateUniqueCodeInMemory = (existingSet) => {
  let code;
  do {
    code = generate6DigitId();
  } while (existingSet.has(code));
  existingSet.add(code);
  return code;
};

// Utility function for batch inserts
async function insertInBatches(Model, docs, batchSize = 1000) {
  const inserted = [];
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    try {
      const batchInserted = await Model.insertMany(batch, { ordered: false });
      inserted.push(...batchInserted);
    } catch (insertError) {
      if (insertError.writeErrors) {
        insertError.writeErrors.forEach((e) => {
          console.error("Document failed:", e.errmsg, e.getOperation());
        });
      }
    }
  }
  return inserted;
}

// Backend changes - createCompany
exports.createCompany = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  const {
    namePrint,
    banks,
    registrationDocTypes: rawDocTypes,
    ...rest
  } = req.body;
  if (!namePrint) throw new ApiError(400, "Company name is required");
  // Early client check_
  if (user.role !== "Client" && user.role !== "Admin") {
    throw new ApiError(403, "Only clients and admins can create companies");
  }
  const clientId = user.role === "Client" ? userId : user.clientID;
  const isExistWithName = await Company.findOne({
    client: clientId,
    namePrint,
  });
  if (isExistWithName) throw new ApiError(409, "Company name already in use");
  // Parallelize file processing (minimal overhead, but cleaner)_
  const [logoUrl, processedDocs, brandingFiles] = await Promise.all([
    req.files?.logo?.[0]?.location || null,
    processRegistrationDocs(
      req.files?.registrationDocs || [],
      rawDocTypes || []
    ),
    req.files?.brandingImages || [],
  ]);
  const code = await generate6DigitUniqueId(Company, "code");
  const banksParsed = JSON.parse(banks || "[]");
  const processedBranding = brandingFiles.map((file) => ({
    type: "banner",
    file: file.location,
    fileName: file.originalname,
    description: "",
  }));
  const company = await Company.create({
    namePrint,
    ...rest,
    code,
    client: clientId,
    banks: banksParsed,
    logo: logoUrl,
    registrationDocs: processedDocs,
    brandingImages: processedBranding,
    createdBy: userId,
    auditLogs: [
      {
        action: "create",
        performedBy: req.user.id,
        timestamp: new Date(),
        details: "company created",
      },
    ],
  });
  ; // Fire audit log async (non-blocking)_
  createAuditLogAsync(req, company._id).catch(console.error);
  res
    .status(201)
    .json(new ApiResponse(201, company, "Company created successfully"));
});

// Helper: Process docs in parallel
// async function processRegistrationDocs(files, rawDocTypes) {
//   if (!files.length) return [];
//   const docTypes = JSON.parse(rawDocTypes || '[]');
//   return Promise.all(files.map((file, index) => ({
//     type: docTypes[index] || 'Other',
//     file: file.location,
//     fileName: file.originalname
//   })));
// }

// Helper: Async audit log
async function createAuditLogAsync(req, companyId) {
  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  const ip =
    ipAddress === "::1" || ipAddress === "127.0.0.1" ? "127.0.0.1" : ipAddress;
  await createAuditLog({
    module: "Company",
    action: "create",
    performedBy: req.user.id,
    referenceId: companyId,
    clientId: req.user.clientID,
    details: "company created successfully",
    ipAddress: ip,
  });
}
exports.createBulkCompanies = asyncHandler(async (req, res) => {
  const { companies } = req.body;

  if (!Array.isArray(companies) || companies.length === 0) {
    throw new ApiError(400, "Companies array is required in body");
  }

  // Validate user
  const userId = req.user.id;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  if (!["Client", "Admin"].includes(user.role)) {
    throw new ApiError(403, "Only clients and admins can create companies");
  }
  const clientId = user.role === "Client" ? userId : user.clientID;
  if (!clientId) throw new ApiError(400, "Client ID is required from token");

  // Preload existing codes
  const existingCompanies = await Company.find({}, "code");
  const existingCodes = new Set(existingCompanies.map((c) => c.code));

  const results = [];
  const errors = [];

  // Preprocess companies
  for (const [index, body] of companies.entries()) {
    try {
      if (!body.namePrint) throw new Error("namePrint is required");

      // Generate or validate unique code
      const code = body.code || generateUniqueCodeInMemory(existingCodes);

      const banks = JSON.parse(body.banks || "[]");

      const companyObj = {
        ...body,
        code,
        client: new mongoose.Types.ObjectId(clientId),
        banks,
        logo: "",
        registrationDocs: [],
        createdBy: new mongoose.Types.ObjectId(userId),
        auditLogs: [
          {
            action: "create",
            performedBy: new mongoose.Types.ObjectId(userId),
            timestamp: new Date(),
            details: "Bulk company import",
          },
        ],
      };

      results.push(companyObj);
    } catch (err) {
      errors.push({
        index,
        namePrint: body?.namePrint,
        code: body?.code,
        error: err.message,
      });
    }
  }

  // Batch insert
  const inserted = await insertInBatches(Company, results, 1000);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        totalReceived: companies.length,
        totalInserted: inserted.length,
        totalFailed: errors.length,
        insertedIds: inserted.map((c) => c._id),
        errors,
      },
      "Bulk company import completed successfully"
    )
  );
});

// 🟢 Agent ke liye apne client ki saari companies laana
exports.getCompaniesForAgent = asyncHandler(async (req, res) => {
  const agentId = req.user.id;

  const agent = await User.findById(agentId);
  if (!agent) throw new ApiError(404, "Agent not found");

  const clientId = req.user.clientID;
  if (!clientId) throw new ApiError(404, "Client not found for this agent");

  const { search, status, sortBy, sortOrder, limit = 3, page = 1 } = req.query;

  let filter = { client: clientId, status: { $ne: "delete" } };

  if (status && status !== "") {
    filter.status = status;
  }

  if (search && search.trim() !== "") {
    const regex = new RegExp(search, "i");
    filter.$or = [
      { namePrint: regex },
      { nameStreet: regex },
      { email: regex },
    ];
  }

  // sorting
  let sort = {};
  if (sortBy) {
    let field = sortBy === "namePrint" ? "namePrint" : "createdAt";
    let order = sortOrder === "desc" ? -1 : 1;
    sort[field] = order;
  } else {
    sort = { createdAt: -1 };
  }

  const perPage = parseInt(limit, 10);
  const currentPage = parseInt(page, 10);
  const skip = (currentPage - 1) * perPage;

  // Get paginated data + total
  const [companies, total] = await Promise.all([
    Company.find(filter)
      .select("-auditLogs")
      .sort(sort)
      .skip(skip)
      .limit(perPage),
    Company.countDocuments(filter),
  ]);

  // 🔥 NEW: Extra counts
  const [gstRegistered, msmeRegistered, activeCompanies, vatRegistered] = await Promise.all([
    Company.countDocuments({
      client: clientId,
      isDeleted: false,
      gstNumber: { $exists: true, $ne: "" },
    }),
    Company.countDocuments({
      client: clientId,
      isDeleted: false,
      msmeNumber: { $exists: true, $ne: "" },
    }),
    Company.countDocuments({
      client: clientId,
      isDeleted: false,
      status: "active",
    }),
    Company.countDocuments({
      client: clientId,
      isDeleted: false,
      vatNumber: { $exists: true, $ne: "" },
    }),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        companies,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
        counts: {
          gstRegistered,
          msmeRegistered,
          activeCompanies,
          vatRegistered
        },
      },
      "Companies fetched successfully"
    )
  );
});

//Assign salesman to company
exports.assignSalesman = async (req, res) => {
  try {
    const { companyId, salesmanId } = req.body;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const salesman = await User.findById(salesmanId);
    if (!salesman || salesman.role !== "Salesman") {
      return res.status(400).json({ error: "Invalid salesman" });
    }

    if (!company.salesmen.includes(salesmanId)) {
      company.salesmen.push(salesmanId);
      await company.save();
    }

    res.json({ message: "Salesman assigned", company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. Set access for salesman in company
exports.setAccess = async (req, res) => {
  try {
    const { companyId, userId, module, permissions } = req.body;

    let access = await CompanyUserAccess.findOne({
      company: companyId,
      user: userId,
      module,
    });

    if (!access) {
      access = new CompanyUserAccess({
        company: companyId,
        user: userId,
        module,
        permissions,
      });
    } else {
      access.permissions = permissions;
    }

    await access.save();

    res.json({ message: "Access updated", access });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. Get access list
exports.getAccess = async (req, res) => {
  try {
    const { companyId, userId } = req.query;
    const access = await CompanyUserAccess.find({
      company: companyId,
      user: userId,
    });
    res.json({ access });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Backend changes - updateCompany
exports.updateCompany = asyncHandler(async (req, res) => {
  console.log("Update Company Request Params:", req.params);
  const { id } = req.params;
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");
  const company = await Company.findById(id);
  if (!company) throw new ApiError(404, "Company not found");
  if (
    user.role === "Client" &&
    company.client.toString() !== user._id.toString()
  ) {
    throw new ApiError(403, "You can only update your own companies");
  }
  const {
    registrationDocTypes: rawDocTypes,
    keptBrandingUrls: rawKeptUrls,
    ...rest
  } = req.body;
  const [logoUrl, processedNewDocs, brandingFiles] = await Promise.all([
    req.files?.logo?.[0]?.location || null,
    processRegistrationDocs(
      req.files?.registrationDocs || [],
      rawDocTypes || []
    ), // Reuse helper from create_
    req.files?.brandingImages || [],
  ]);
  // 4️⃣ Prepare update data
  const updateData = { ...rest }; // shallow copy_
  if (logoUrl) {
    updateData.logo = logoUrl;
  }
  if (req.body?.banks) {
    try {
      updateData.banks = JSON.parse(req.body.banks) || [];
    } catch {
      throw new ApiError(400, "Banks field must be a valid JSON array");
    }
  }
  if (processedNewDocs.length > 0) {
    // Filter out existing docs with types that are being updated_
    const existingDocs = (company.registrationDocs || []).filter(
      (doc) => !(rawDocTypes || []).includes(doc.type) // Use parsed docTypes_
    );
    updateData.registrationDocs = [...existingDocs, ...processedNewDocs];
  }
  //  images update - handle kept + new_
  const keptBrandingUrls = rawKeptUrls ? JSON.parse(rawKeptUrls) : null;
  const newBranding = brandingFiles.map((file) => ({
    type: "banner",
    file: file.location,
    fileName: file.originalname,
    description: "",
  }));
  let finalBranding = [];
  if (keptBrandingUrls !== null) {
    const existingToKeep = (company.brandingImages || []).filter((img) =>
      keptBrandingUrls.includes(img.file)
    );
    finalBranding = [...existingToKeep, ...newBranding];
  } else {
    finalBranding = [...(company.brandingImages || []), ...newBranding];
  }
  if (finalBranding.length > 0) {
    updateData.brandingImages = finalBranding;
  }
  // If no new files, existing docs remain unchanged_
  const oldData = company.toObject();
  const changes = {};
  Object.keys(updateData).forEach((key) => {
    if (key === "auditLogs") return;
    ; // ✅ skip auditLogs in update_
    if (JSON.stringify(oldData[key]) !== JSON.stringify(updateData[key])) {
      changes[key] = { from: oldData[key], to: updateData[key] };
    }
  });
  Object.keys(updateData).forEach((key) => {
    if (key !== "auditLogs") company[key] = updateData[key];
  });
  if (!company.auditLogs) company.auditLogs = [];
  company.auditLogs.push({
    action: "update",
    performedBy: new mongoose.Types.ObjectId(req.user.id),
    timestamp: new Date(),
    details: "Company updated",
    changes,
  });
  await company.save();
  createAuditLogAsyncUpdate(req, company._id, changes).catch(console.error);
  res
    .status(200)
    .json(new ApiResponse(200, company, "Company updated successfully"));
});

// Helper: Async audit log for update (adapted from create)
async function createAuditLogAsyncUpdate(req, companyId, changes) {
  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  const ip =
    ipAddress === "::1" || ipAddress === "127.0.0.1" ? "127.0.0.1" : ipAddress;
  await createAuditLog({
    module: "Company",
    action: "update",
    performedBy: req.user.id,
    referenceId: companyId,
    clientId: req.user.clientID,
    details: "Company updated successfully",
    changes, // Include changes
    ipAddress: ip,
  });
}

// Get Companies
exports.getCompanies = asyncHandler(async (req, res) => {
  const { clientId } = req.query;

  const filter = {client:clientId, status: { $ne: "delete" } }; // 🟢 sirf active companies
  if (clientId) filter.client = clientId;

  const companies = await Company.find(filter).select("-auditLogs");
  const newcompanies = { companies: [...companies] };

  res
    .status(200)
    .json(new ApiResponse(200, companies, "Companies fetched successfully"));
});

// Delete Company (Soft Delete)
exports.deleteCompany = asyncHandler(async (req, res) => {
  // console.log("Delete Company Request Params:", req.params);
  const { id } = req.params;
  const clientID = req.user.clientID;
  const user = await User.findById(req.user.id);

  if (!user) throw new ApiError(404, "User not found");

  const company = await Company.findById(id);
  if (!company) throw new ApiError(404, "Company not found");

  // 🔐 Ownership check
  if (
    user.role === "Client" &&
    company.client.toString() !== user._id.toString()
  ) {
    throw new ApiError(403, "You can only delete your own companies");
  }

  company.status = "delete"; // 🟢 Soft delete
  company.auditLogs.push({
    action: "delete",
    performedBy: new mongoose.Types.ObjectId(req.user.id),
    timestamp: new Date(),
    details: "User marked as deleted",
  });
  await company.save();
  // console.log("Company marked as deleted:", company);

  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;

  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }

  await User.updateMany(
    {"access.company": id},
    {
      $pull: {
        access: { company: id },
      },
    }
  )
  await createAuditLog({
    module: "Company",
    action: "delete",
    performedBy: req.user.id,
    referenceId: company._id,
    clientId: req.user.clientID,
    details: "comapny marked as deleted",
    ipAddress,
  });

  res
    .status(200)
    .json(new ApiResponse(200, null, "Company deleted successfully"));
});

exports.generateCompanyDocumentationPDF = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  const apiDocs = {
    baseUrl: "https://api.ledgerface.com/api/",
    authentication: {
      type: "Bearer Token (JWT)",
      header: "Authorization: Bearer <your_token>",
    },
    apis: [
      {
        title: "Login",
        endpoint: "POST /auth/login",
        requestType: "application/json",
        description: "Authenticate user and obtain JWT token.",
        body: {
          email: "user@example.com",
          password: "your_password",
        },
        response: {
          statusCode: 200,
          message: "Login successful",
          token: "<JWT_TOKEN>",
          userData: {
            id: "68c1503077fd742fa21575df",
            name: "John Doe",
            role: "Admin",
          },
        },
      },
      {
        title: "Create Company",
        endpoint: "POST /company/create",
        requestType: "multipart/form-data",
        description:
          "Send data as form-data. If you are uploading a logo or registration documents, include the files along with the respective fields.",
        body: {
          namePrint: "Global Tech Solutions Pvt Ltd",
          nameStreet: "IT Park Road",
          address1: "Plot 45, Phase 2",
          address2: "Cyber Hub Building",
          address3: "Opposite Metro Station",
          city: "Bengaluru",
          pincode: "560001",
          state: "Karnataka",
          country: "India",
          telephone: "080-26543210",
          mobile: "+91-9988776655",
          email: "contact@globaltech.com",
          gstNumber: "29AACCG1234L1Z9",
          defaultCurrency: "INR",
          banks: [
            {
              name: "State Bank of India",
              accountNumber: "1122334455",
              ifsc: "SBIN0007890",
              branch: "MG Road, Bengaluru",
            },
          ],
          logo: "(File Upload)",
          registrationDocs: "(Multiple File Upload)",
        },
        response: {
          statusCode: 201,
          message: "Company created successfully",
        },
      },
      {
        title: "Get All Companies",
        endpoint: "GET /company/all",
        requestType: "application/json",
        response: {
          companies: [
            {
              _id: "68c1503077fd742fa21575df",
              namePrint: "Global Tech Solutions Pvt Ltd",
              city: "Bengaluru",
            },
          ],
        },
      },
      {
        title: "Get Company By ID",
        endpoint: "GET /company/:id",
        requestType: "application/json",
        response: {
          _id: "68c1503077fd742fa21575df",
          namePrint: "Global Tech Solutions Pvt Ltd",
          gstNumber: "29AACCG1234L1Z9",
        },
      },
      {
        title: "Update Company",
        endpoint: "PUT /company/update/:id",
        requestType: "multipart/form-data",
        description:
          "Use form-data for updating details, especially when updating the logo or registration documents.",
        body: {
          namePrint: "Updated Tech Pvt Ltd",
          email: "info@updatedtech.com",
        },
        response: {
          message: "Company updated successfully",
        },
      },
      {
        title: "Delete Company",
        endpoint: "DELETE /company/:id",
        requestType: "application/json",
        response: {
          message: "Company deleted successfully",
        },
      },
    ],
  };
  const html = `
    <html>
      <head>
        <title>Company API Documentation</title>
        <style>
          body { font-family: 'Arial', sans-serif; padding: 30px; color: #222; }
          h1, h2 { color: #2a5d84; }
          h1 { text-align: center; border-bottom: 2px solid #2a5d84; padding-bottom: 10px; }
          .endpoint {
            background: #f9f9f9;
            border: 1px solid #ccc;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 25px;
          }
          pre {
            background: #1e1e1e;
            color: #00ff90;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
          }
          code { font-family: monospace; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>Company API Documentation</h1>
        <h2>Base URL</h2>
        <pre><code>${apiDocs.baseUrl}</code></pre>
        <h2>Authentication</h2>
        <pre><code>${JSON.stringify(apiDocs.authentication, null, 2)}</code></pre>
        <h2>company ID: ${companyId || "N/A"}</h2>
        <h2>Endpoints</h2>
        ${apiDocs.apis
          .map(
            (api) => `
            <div class="endpoint">
              <h3>${api.title}</h3>
              <strong>Endpoint:</strong>
              <pre><code>${api.endpoint}</code></pre>
              <strong>Request Type:</strong>
              <pre><code>${api.requestType}</code></pre>
              ${
                api.description
                  ? `<p><strong>Description:</strong> ${api.description}</p>`
                  : ""
              }
              ${
                api.body
                  ? `<strong>Request Body:</strong><pre><code>${JSON.stringify(
                      api.body,
                      null,
                      2
                    )}</code></pre>`
                  : ""
              }
              <strong>Response:</strong>
              <pre><code>${JSON.stringify(api.response, null, 2)}</code></pre>
            </div>
          `
          )
          .join("")}
        <hr>
        <p style="text-align:center; color:#777; font-size:12px;">
          Generated on ${new Date().toLocaleString()}
        </p>
      </body>
    </html>
  `;
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: "new",
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "15mm", bottom: "15mm", left: "10mm", right: "10mm" },
  });
  await browser.close();
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="Company_API_Documentation.pdf"',
  });
  res.send(pdfBuffer);
});

exports.deleteCompaniesByClientId = asyncHandler(async (req, res) => {
  const { clientId } = req.user.clientID; // e.g., /delete-companies/:clientId

  if (!clientId) {
    return res.status(400).json({ message: "Client ID is required" });
  }

  const result = await Company.updateMany({ client: clientId },{status: "delete"});

  if (result.deletedCount === 0) {
    return res
      .status(404)
      .json({ message: "No companies found for this client ID" });
  }

  res.status(200).json({
    message: `${result.deletedCount} companies deleted successfully`,
  });
});
