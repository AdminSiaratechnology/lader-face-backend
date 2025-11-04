const Agent = require('../models/Agent');
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
// const { generateUniqueId } = require('../utils/generate16DigiId');
const mongoose = require('mongoose');
const User=require("../models/User")
const   {createAuditLog}=require("../utils/createAuditLog")
const { generateUniqueId } = require('../utils/generate16DigiId');
const processRegistrationDocs =require("../utils/processRegistrationDocs")

// Generate unique code using timestamp and index
// const generateUniqueId = (index) => {
//   const timestamp = Date.now();
//   const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
//   return `${timestamp}${index.toString().padStart(4, '0')}${random}`.slice(-18); // 18-digit code to match input length
// };
// console.log(generateUniqueId(1))
// Insert records in batches with robust error handling
const insertInBatches = async (data, batchSize) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.error('No valid data to insert');
    return [];
  }

  const results = [];
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    if (!batch || !Array.isArray(batch) || batch.length === 0) {
      console.error(`Invalid batch at index ${i}`);
      continue;
    }

    console.log(`Inserting batch of ${batch.length} records`);
    try {
      const inserted = await Agent.insertMany(batch, { ordered: false });
      if (inserted && Array.isArray(inserted)) {
        results.push(...inserted);
        console.log(`Inserted ${inserted.length} records in batch`);
      } else {
        console.error('No records inserted in batch');
      }
    } catch (error) {
      if (error.name === 'MongoBulkWriteError' && error.code === 11000) {
        const failedDocs = error.writeResult?.result?.writeErrors?.map(err => ({
          code: err.op.code,
          error: err.errmsg
        })) || [];
        const successfulDocs = batch.filter(doc => !failedDocs.some(f => f.code === doc.code));
        results.push(...successfulDocs.map(doc => ({ ...doc, _id: doc._id || new mongoose.Types.ObjectId() })));
        failedDocs.forEach(failed => {
          console.error(`Failed to insert record with code ${failed.code}: ${failed.error}`);
        });
      } else {
        console.error(`Batch insertion failed: ${error.message}`);
      }
    }
  }

  // Verify inserted records
  const insertedIds = results.map(doc => doc._id);
  const verifiedDocs = insertedIds.length > 0 ? await Agent.find({ _id: { $in: insertedIds } }) : [];
  console.log(`Verified ${verifiedDocs.length} records in database`);
  return verifiedDocs;
};

// 🟢 Create Agent
exports.createAgent = asyncHandler(async (req, res) => {
  const {
    agentName,
    emailAddress,
    phoneNumber,
    companyID, // company reference
    registrationDocTypes: rawDocTypes, // Extract rawDocTypes like in Company
    ...rest
  } = req.body;
  const adminId = req?.user?.id;

  if (!agentName) {
    throw new ApiError(400, "Agent name and code are required");
  }
  const clientId = req.user.clientID;
  if (!clientId) {
    throw new ApiError(400, "Client ID is required from token");
  }

  let logoUrl = null;

  // Logo file
  if (req?.files?.['logo'] && req?.files?.['logo'][0]) {
    logoUrl = req.files['logo'][0].location;
  }

  // Registration docs files - Use processRegistrationDocs like in Company
  const processedDocs = await processRegistrationDocs(req.files?.registrationDocs || [], rawDocTypes);

  let code = await generateUniqueId(Agent, "code");
  console.log(JSON.parse(req.body.banks), "JSON.parse(req.body.banks)");

  const agent = await Agent.create({
    agentName,
    code,
    clientId,
    emailAddress,
    phoneNumber,
    companyID,
    ...rest,
    logo: logoUrl || "",
    registrationDocs: processedDocs,
    banks: JSON.parse(req.body.banks),
    company: companyID,
    createdBy: adminId,
                 auditLogs: [
                      {
                        action: "create",
                        performedBy: adminId ? new mongoose.Types.ObjectId(adminId) : null,
                        timestamp: new Date(),
                        details: "Agent created",
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
    module: "Agent",
    action: "create",
    performedBy: req.user.id,
    referenceId: agent._id,
    clientId,
    details: "agent created successfully",
    ipAddress,
  });

  res
    .status(201)
    .json(new ApiResponse(201, agent, "Agent created successfully"));
});



exports.createBulkAgents = asyncHandler(async (req, res) => {
  console.log("Processing agents");
  const { agents } = req.body;

  // Validate input
  if (!Array.isArray(agents) || agents.length === 0) {
    throw new ApiError(400, "Agents array is required in body");
  }

  // Validate user
  const userId = req.user.id;
  const user = await User.findById(userId);
  console.log(user, "user");
  if (!user) throw new ApiError(404, "User not found");
  const clientId = req.user.clientID;
  if (!clientId) throw new ApiError(400, "Client ID is required from token");

  // Preload company IDs
  const companies = await Company.find({}, "_id");
  const validCompanyIds = new Set(companies.map((c) => String(c._id)));

  // Preload existing codes
  const existingAgents = await Agent.find({}, "code");
  const existingCodes = new Set(existingAgents.map(agent => agent.code));

  const results = [];
  const errors = [];
  const seenCodes = new Set();

  // Process agents
  for (const [index, body] of agents.entries()) {
    try {
      // Required fields
      if (!body.agentName || !body.company) {
        throw new Error("agentName and company are required");
      }
      if (!validCompanyIds.has(String(body.company))) {
        throw new Error("Invalid company ID");
      }

      // Generate or validate code
      let code = body.code;
      if (!code) {
        code = generateUniqueId(index); // Generate 18-digit code
      } else {
        // Check for duplicate code in the input batch
        if (seenCodes.has(code)) {
          throw new Error("Duplicate code within batch");
        }
        // Check for duplicate code in the database
        if (existingCodes.has(code)) {
          throw new Error("Code already exists in database");
        }
      }
      seenCodes.add(code);

      // Generate unique shortName if not provided
      const shortName = body.shortName || `${body.agentName.replace(/\s+/g, '')}${index.toString().padStart(3, '0')}`;

      // Generate unique values for optional fields if not provided
      const contactPerson = body.contactPerson || body.agentName;
      const designation = body.designation || `Agent ${index + 1}`;
      const phoneNumber = body.phoneNumber || `+919${(973884720 + index).toString().padStart(9, '0')}`;
      const emailAddress = body.emailAddress || `${body.agentName.replace(/\s+/g, '').toLowerCase()}${index}@gmail.com`;
      const addressLine1 = body.addressLine1 || `address${index} sector ${body.city || 'Delhi'}`.toLowerCase();
      const city = body.city || "Delhi";
      const state = body.state || "Delhi";
      const zipCode = body.zipCode || (110094 + index).toString().padStart(6, '0');

      const agentObj = {
        _id: new mongoose.Types.ObjectId(), // Generate unique_ id
        company: body.company,
        clientId,
        agentType: body.agentType || "individual",
        agentName: body.agentName,
        shortName,
        agentStatus: body.agentStatus || "active",
        status: body.status || "Active",
        contactPerson,
        designation,
        phoneNumber,
        emailAddress,
        addressLine1,
        city,
        state,
        zipCode,
        country: body.country || "India",
        currency: body.currency || "INR",
        isTaxExempt: body.isTaxExempt || false,
        reverseCharge: body.reverseCharge || false,
        acceptedPaymentMethods: body.acceptedPaymentMethods || ["[\"[\\\"[]\\\"]\""],
        banks: body.banks || [],
        dataSource: body.dataSource || "manual",
        agentPriority: body.agentPriority || "medium",
        logo: "", // Skipped as per request
        registrationDocs: [], // Skipped as per request
        createdBy: userId,
        performanceRating: body.performanceRating || 0,
        activeContracts: body.activeContracts || 0,
        code,
        auditLogs: [
          {
            action: "create",
            performedBy: new mongoose.Types.ObjectId(userId),
            timestamp: new Date(),
            details: "Bulk agent import",
          },
        ],
      };

      results.push(agentObj);
    } catch (err) {
      errors.push({
        index,
        agentName: body?.agentName,
        code: body?.code,
        error: err.message,
      });
    }
  }

  // Batch insert
  const inserted = await insertInBatches(results, 1000);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        totalReceived: agents.length,
        totalInserted: inserted.length,
        totalFailed: errors.length,
        insertedIds: inserted.map((a) => a._id),
        errors,
      },
      "Bulk agent import completed successfully"
    )
  );
});

// 🟢 Update Agent
exports.updateAgent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1. Fetch agent
  const agent = await Agent.findById(id);
  if (!agent) throw new ApiError(404, "Agent not found");

  // 2. Destructure like Company
  const { registrationDocTypes: rawDocTypes, ...rest } = req.body;

  // 3. Parallelize file processing (logo + docs)
  const [logoUrl, processedNewDocs] = await Promise.all([
    req.files?.logo?.[0]?.location || null,
    processRegistrationDocs(req.files?.registrationDocs || [], rawDocTypes),
  ]);

  // 4. Prepare update data
  const updateData = { ...rest };

  // Logo
  if (logoUrl) {
    updateData.logo = logoUrl;
  }

  // Banks
  if (req.body.banks) {
    try {
      updateData.banks = typeof req.body.banks === "string"
        ? JSON.parse(req.body.banks)
        : req.body.banks;
    } catch {
      throw new ApiError(400, "Invalid banks JSON");
    }
  }

  // 5. Registration Docs: Replace by type (same as Company)
  if (processedNewDocs.length > 0) {
    let parsedTypes = [];
    try {
      parsedTypes = typeof rawDocTypes === "string" ? JSON.parse(rawDocTypes) : rawDocTypes || [];
    } catch (e) {
      parsedTypes = [];
    }

    // Keep existing docs that are NOT being updated
    const existingDocs = (agent.registrationDocs || []).filter(
      doc => !parsedTypes.includes(doc.type)
    );

    // Replace only the types that were uploaded
    const finalDocs = [...existingDocs];
    processedNewDocs.forEach((newDoc, idx) => {
      const type = parsedTypes[idx];
      if (type) {
        const existingIndex = finalDocs.findIndex(d => d.type === type);
        if (existingIndex !== -1) {
          finalDocs[existingIndex] = newDoc;
        } else {
          finalDocs.push(newDoc);
        }
      }
    });

    updateData.registrationDocs = finalDocs;
  }
  // If no new docs → keep existing

  // 6. Track changes for audit
  const oldData = agent.toObject();
  const changes = {};
  Object.keys(updateData).forEach(key => {
    if (key === "auditLogs") return;
    if (JSON.stringify(oldData[key]) !== JSON.stringify(updateData[key])) {
      changes[key] = { from: oldData[key], to: updateData[key] };
    }
  });

  // 7. Apply updates (skip auditLogs)
  Object.keys(updateData).forEach(key => {
    if (key !== "auditLogs") {
      agent[key] = updateData[key];
    }
  });

  // 8. Push audit log
  if (!agent.auditLogs) agent.auditLogs = [];
  agent.auditLogs.push({
    action: "update",
    performedBy: new mongoose.Types.ObjectId(req.user.id),
    timestamp: new Date(),
    details: "Agent updated",
    changes,
  });

  // 9. Save
  await agent.save();

  // 10. Create audit log (same as Company)
  let ipAddress = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }

  await createAuditLog({
    module: "Agent",
    action: "update",
    performedBy: req.user.id,
    referenceId: agent._id,
    clientId: req.user.clientID,
    details: "Agent updated successfully",
    changes,
    ipAddress,
  });

  // 11. Respond
  res.status(200).json(new ApiResponse(200, agent, "Agent updated successfully"));
});



// 🟢 Get All Agents (for a company)
exports.getAgentsByCompany = asyncHandler(async (req, res) => {
  
  const clientId=req.user.clientID
   if (!clientId) throw new ApiError(400, "Client ID is required");
    const { companyId } = req.params;
    console.log(req.params,"req.prams")
       if (!companyId) throw new ApiError(400, "Company ID is required");

  
  const {
    search="",
    status="",
    sortBy='',
    sortOrder="desc",
    page=1,
    limit=10
  }=req.query;
  const perPage=parseInt(limit,10)
  const currentPage=Math.max(parseInt(page,10),1);
  const skip=(currentPage-1)*perPage;
  const filter={clientId,company:companyId,status:{$ne:"delete"}}

  if(status && status.trim()!=="") filter.status=status;
  if(search && search.trim()!=="") {
     filter.$or = [
      { agentName: { $regex: search, $options: "i" } },
      { emailAddress: { $regex: search, $options: "i" } },
      { phoneNumber: { $regex: search, $options: "i" } },
    ];
  }
  // Sorting
  const sortDirection = sortOrder === "desc" ? -1 : 1;
  const sortOptions = { [sortBy || "createdAt"]: sortDirection };
  // Fetch data & total count
  const [agents, total] = await Promise.all([
    Agent.find(filter).select("-auditLogs")
      .sort(sortOptions)
      .skip(skip)
      .limit(perPage),
    Agent.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        agents,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      agents.length ? "Agents fetched successfully" : "No agents found"
    )
  );

});

exports.getAgentsByClient = asyncHandler(async (req, res) => {
  const clientId = req.user.clientID;
  if (!clientId) throw new ApiError(400, "Client ID is required");

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
  const filter = { clientId: clientId, status: { $ne: "delete" } };
  if (status && status.trim() !== "") filter.status = status;

  if (search && search.trim() !== "") {
    filter.$or = [
      { agentName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { contactNumber: { $regex: search, $options: "i" } },
    ];
  }

  // Sorting
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };

  // Fetch data & total count
  const [agents, total] = await Promise.all([
    Agent.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(perPage),
    Agent.countDocuments(filter),
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        agents,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      agents.length ? "Agents fetched successfully" : "No agents found"
    )
  );
});


// 🟢 Get Single Agent
exports.getAgentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const agent = await Agent.findById(id).select("-auditLogs").populate("company");
  if (!agent) throw new ApiError(404, "Agent not found");

  res
    .status(200)
    .json(new ApiResponse(200, agent, "Agent fetched successfully"));
});

// Delete Agent
exports.deleteAgent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // check if id is passed
  if (!id) {
    throw new ApiError(400, "Agent ID is required");
  }

  // find agent
  const agent = await Agent.findById(id);
  if (!agent) {
    throw new ApiError(404, "Agent not found");
  }

  // check permission
  if (String(agent.clientId) !== String(req.user.clientID)) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  // soft delete
  agent.status = "delete";
    agent.auditLogs.push({
            action: "delete",
            performedBy: new mongoose.Types.ObjectId(req.user.id),
            timestamp: new Date(),
            details: "Agent marked as deleted",
          });
  await agent.save();

  let ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  
  // convert ::1 → 127.0.0.1
  if (ipAddress === "::1" || ipAddress === "127.0.0.1") {
    ipAddress = "127.0.0.1";
  }
    await createAuditLog({
    module: "Agent",
    action: "delete",
    performedBy: req.user.id,
    referenceId: agent._id,
    clientId: req.user.clientID,
    details: "agent marked as deleted",
    ipAddress,
  });

  // send response
  res.status(200).json({
    success: true,
    message: "Agent deleted successfully",
    data: agent,
  });
});