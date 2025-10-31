const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const User = require('../models/User');
const {generate6DigitId}=require("../utils/newgenerate16DigiId")
const {generate6DigitUniqueId} = require("../utils/generate6DigitUniqueId")

const puppeteer = require("puppeteer");
const mongoose = require('mongoose');
const   {createAuditLog}=require("../utils/createAuditLog")

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
        insertError.writeErrors.forEach(e => {
          console.error('Document failed:', e.errmsg, e.getOperation());
        });
      }
    }
  }
  return inserted;
}


// Backend changes - createCompany
exports.createCompany = asyncHandler(async (req, res) => {
  console.log("Request Body:", req.user);
  const adminId = req?.user?.id;
  const clientId=req.user.clientID
  
  // res.status(200).json({ message: "Create Company - Not Implemented" });
  try {

    
  
  const userId = req.user.id;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  // console.log("Logged in user:", user);
    const { namePrint, banks, ...rest } = req.body;
    if (!namePrint) throw new ApiError(400, 'Company name is required');
    
    let logoUrl = null;
    let registrationDocs = [];
    // console.log("Request Files:", req.files);
    
    if (req?.files?.['logo'] && req?.files?.['logo'][0]) {
        logoUrl = req.files['logo'][0].location;
    }
    console.log(req.files,"req.files")
    
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
    
//    res.send("Create Company Controller is working")
// res.send(req.body)
if(user.role==="Client" || user.role==="Admin"){
  // Allow creating company
  // console.log("banks:", JSON.parse(banks) || []);
  // console.log(generateUniqueId,"generateUniqueId")
  
  let code=await generate6DigitUniqueId(Company,"code")
  // console.log("jsdnfjbsjhd")
  // let code="123456"
  const isExistWithName=await Company.find({client:clientId,namePrint})
  console.log(isExistWithName.length,"req.user,")


   if (isExistWithName && 0<isExistWithName.length)  throw new ApiError(409, "Company name already in use");

  


  const company = await Company.create({
    namePrint,
    ...rest,
    code:code,
    client: user.role === 'Client' ? userId : user.clientID,
    banks: JSON.parse(banks) || [],
    logo: logoUrl || "",
    registrationDocs: registrationDocs || [],
    createdBy: userId,
     auditLogs: [
          {
            action: "create",
            performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
            timestamp: new Date(),
            details: "company created",
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
    module: "Company",
    action: "create",
    performedBy: req.user.id,
    referenceId: company._id,
    clientId:req.user.clientID,
    details: "comapny created successfully",
    ipAddress,
  });

  res.status(201).json(new ApiResponse(201, company, "Company created successfully"));
} else {
  throw new ApiError(403, "Only clients and admins can create companies");
}
} catch (error) {
  console.log("Error creating company:", error);
  res.status(500).json({ error: error.message});
}}
);
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
  const clientId = user.role === 'Client' ? userId : user.clientID;
  if (!clientId) throw new ApiError(400, "Client ID is required from token");

  // Preload existing codes
  const existingCompanies = await Company.find({}, "code");
  const existingCodes = new Set(existingCompanies.map(c => c.code));

  const results = [];
  const errors = [];

  // Preprocess companies
  for (const [index, body] of companies.entries()) {
    try {
      if (!body.namePrint) throw new Error("namePrint is required");

      // Generate or validate unique code
      const code = body.code || generateUniqueCodeInMemory(existingCodes);

      const banks = JSON.parse(body.banks || '[]');

      const companyObj = {
        ...body,
        code,
        client: new mongoose.Types.ObjectId(clientId),
        banks,
        logo: "",
        registrationDocs: [],
        createdBy: new mongoose.Types.ObjectId(userId),
        auditLogs: [{
          action: "create",
          performedBy: new mongoose.Types.ObjectId(userId),
          timestamp: new Date(),
          details: "Bulk company import",
        }],
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
        insertedIds: inserted.map(c => c._id),
        errors,
      },
      "Bulk company import completed successfully"
    )
  );
});


// 🟢 Agent ke liye apne client ki saari companies laana
exports.getCompaniesForAgent = asyncHandler(async (req, res) => {
  const agentId = req.user.id; 
  // console.log("Agent ID from req.user:", agentId);

  // 1. Agent nikaalo
  const agent = await User.findById(agentId);
  if (!agent) {
    throw new ApiError(404, "Agent not found");
  }

  // 2. Client ID nikaalo
  const clientId = req.user.clientID;
  if (!clientId) {
    throw new ApiError(404, "Client not found for this agent");
  }

  // 3. Query params lo
  const { search, status, sortBy, sortOrder
    , 
    limit = 3, page = 1 
  } = req.query;
  // console.log(req.query,"reqqqqqq")
  // console.log(search, status, sortBy, sortOrder,"fasdfafdasf",clientId)
  // console.log(clientId,"id")
  
  


  let filter = { client: clientId,isDeleted:false };

  // status filter
  if (status && status !== "") {
    filter.status = status;
  }

  // search filter
  if (search && search.trim() !== "") {
    const regex = new RegExp(search, "i"); // case-insensitive search
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
    sort = { createdAt: -1 }; // default latest first
  }

  // pagination
  const perPage = parseInt(limit, 10);
  const currentPage = parseInt(page, 10);
  const skip = (currentPage - 1) * perPage;

  // console.log("Filter:", filter, "Sort:", sort, "Skip:", skip, "Limit:", perPage);

  // 4. DB se companies nikaalo
  const [companies, total] = await Promise.all([
    Company.find(filter).select("-auditLogs").sort(sort)
    .skip(skip).limit(perPage)
    ,
    Company.countDocuments(filter),
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

    let access = await CompanyUserAccess.findOne({ company: companyId, user: userId, module });

    if (!access) {
      access = new CompanyUserAccess({ company: companyId, user: userId, module, permissions });
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
    const access = await CompanyUserAccess.find({ company: companyId, user: userId });
    res.json({ access });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Backend changes - updateCompany
exports.updateCompany = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1️⃣ Logged-in user check
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  // 2️⃣ Fetch company
  const company = await Company.findById(id);
  if (!company) throw new ApiError(404, "Company not found");

  // 3️⃣ Ownership check
  if (user.role === "Client" && company.client.toString() !== user._id.toString()) {
    throw new ApiError(403, "You can only update your own companies");
  }

  // 4️⃣ Prepare update data safely
  const updateData = { ...req.body }; // shallow copy

  // Logo update
  if (req?.files?.["logo"] && req?.files?.["logo"][0]) {
    updateData.logo = req.files["logo"][0].location;
  }
  console.log(req?.files,"req?.files?.",req.body.registrationDocTypes,"req.body.registrationDocTypes)")
  
  let registrationDocTypes;
  try {
    registrationDocTypes = JSON.parse(req.body.registrationDocTypes || '[]');
  } catch (e) {
    console.error('Failed to parse registrationDocTypes:', e);
    registrationDocTypes = [];
  }

  // Registration docs update - merge with existing
  if (req?.files?.["registrationDocs"]) {
    const newDocs = req.files["registrationDocs"].map((file, index) => ({
      type: registrationDocTypes[index] || "Other",
      file: file.location,
      fileName: file.originalname,
    }));

    // Filter out existing docs with types that are being updated
    const existingDocs = (company.registrationDocs || []).filter(
      (doc) => !registrationDocTypes.includes(doc.type)
    );

    // Replace matching types with new docs, append others
    updateData.registrationDocs = [...existingDocs, ...newDocs];
  }
  // If no new files, existing docs remain unchanged

  // Banks parsing
  if (req.body?.banks) {
    try {
      updateData.banks = JSON.parse(req.body.banks) || [];
    } catch {
      throw new ApiError(400, "Banks field must be a valid JSON array");
    }
  }

  // 5️⃣ Track changes for audit log
  const oldData = company.toObject();
  const changes = {};
  Object.keys(updateData).forEach(key => {
    if (key === "auditLogs") return; // ✅ skip auditLogs in update
    if (JSON.stringify(oldData[key]) !== JSON.stringify(updateData[key])) {
      changes[key] = { from: oldData[key], to: updateData[key] };
    }
  });

  // 6️⃣ Apply updates (excluding auditLogs)
  Object.keys(updateData).forEach(key => {
    if (key !== "auditLogs") company[key] = updateData[key];
  });

  // 7️⃣ Push audit log safely
  if (!company.auditLogs) company.auditLogs = [];
  company.auditLogs.push({
    action: "update",
    performedBy: new mongoose.Types.ObjectId(req.user.id),
    timestamp: new Date(),
    details: "Company updated",
    changes,
  });

  // 8️⃣ Save company
  await company.save();

   let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
  await createAuditLog({
    module: "Company",
    action: "update",
    performedBy: req.user.id,
    referenceId: company._id,
    clientId: req.user.clientID,
    details: "Company updated successfully",
    changes,
    ipAddress,
  });

  // 9️⃣ Respond
  res.status(200).json(new ApiResponse(200, company, "Company updated successfully"));
});



// Get Companies
exports.getCompanies = asyncHandler(async (req, res) => {
  const { clientId } = req.query;

  const filter = { isDeleted: false }; // 🟢 sirf active companies
  if (clientId) filter.client = clientId;

  const companies = await Company.find(filter).select("-auditLogs");
  const newcompanies={companies:[...companies]}


  res.status(200).json(new ApiResponse(200, companies, "Companies fetched successfully"));
});

// Delete Company (Soft Delete)
exports.deleteCompany = asyncHandler(async (req, res) => {
  // console.log("Delete Company Request Params:", req.params);
  const { id } = req.params;
  const user = await User.findById(req.user.id);

  if (!user) throw new ApiError(404, "User not found");

  const company = await Company.findById(id);
  if (!company) throw new ApiError(404, "Company not found");

  // 🔐 Ownership check
  if (user.role === "Client" && company.client.toString() !== user._id.toString()) {
    throw new ApiError(403, "You can only delete your own companies");
  }

  company.isDeleted = true; // 🟢 Soft delete
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
    await createAuditLog({
    module: "Company",
    action: "delete",
    performedBy: req.user.id,
    referenceId: company._id,
    clientId: req.user.clientID,
    details: "comapny marked as deleted",
    ipAddress,
  });

  res.status(200).json(new ApiResponse(200, null, "Company deleted successfully"));
});

exports.generateCompanyDocumentationPDF = asyncHandler(async (req, res) => {
  const apiDocs = {
    baseUrl: "http://localhost:8000/api",
    authentication: {
      type: "Bearer Token (JWT)",
      header: "Authorization: Bearer <your_token>",
    },
    apis: [
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

  const result = await Company.deleteMany({client: clientId });

  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "No companies found for this client ID" });
  }

  res.status(200).json({
    message: `${result.deletedCount} companies deleted successfully`,
  });
});

