const Agent = require('../models/Agent');
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { generateUniqueId } = require('../utils/generate16DigiId');
const mongoose = require('mongoose');

// 🟢 Create Agent
exports.createAgent = asyncHandler(async (req, res) => {
  const {
    agentName,
    emailAddress,
    phoneNumber,
    companyID, // company reference
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
    registrationDocs: registrationDocs || [],
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

  res
    .status(201)
    .json(new ApiResponse(201, agent, "Agent created successfully"));
});

// 🟢 Update Agent
exports.updateAgent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // ✅ Step 1: Fetch existing agent
  const agent = await Agent.findById(id);
  if (!agent) throw new ApiError(404, "Agent not found");

  let logoUrl = agent.logo;
  let registrationDocs = agent.registrationDocs;
  let banks = agent.banks;

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

  // ✅ Step 4: Prepare safe update data
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

  // ✅ Step 6: Track changes before saving
  const oldData = agent.toObject();
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
    agent[key] = updateData[key];
  }

  // ✅ Step 9: Push new audit log entry
  agent.auditLogs.push({
    action: "update",
    performedBy: req.user?.id || null,
    details: "Agent updated successfully",
    changes,
  });

  // ✅ Step 10: Save document
  await agent.save();

  res
    .status(200)
    .json(new ApiResponse(200, agent, "Agent updated successfully"));
});


// 🟢 Get All Agents (for a company)
exports.getAgentsByCompany = asyncHandler(async (req, res) => {
  const { companyId } = req.query;

  if (!companyId) throw new ApiError(400, "Company ID is required");

  const agents = await Agent.find({ company: companyId }).populate("company");

  res
    .status(200)
    .json(new ApiResponse(200, agents, "Agents fetched successfully"));
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
  const filter = { clientId: clientId, status: { $ne: "Delete" } };
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

  const agent = await Agent.findById(id).populate("company");
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
  agent.status = "Delete";
    agent.auditLogs.push({
            action: "delete",
            performedBy: new mongoose.Types.ObjectId(req.user.id),
            timestamp: new Date(),
            details: "Agent marked as deleted",
          });
  await agent.save();

  // send response
  res.status(200).json({
    success: true,
    message: "Agent deleted successfully",
    data: agent,
  });
});