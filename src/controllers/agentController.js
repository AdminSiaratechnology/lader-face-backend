const Agent = require('../models/Agent');
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const { generateUniqueId } = require('../utils/generate16DigiId');
const { json } = require('express');

// 🟢 Create Agent
exports.createAgent = asyncHandler(async (req, res) => {
  const {
    agentName,
    emailAddress,
    phoneNumber,
    companyID, // company reference
    ...rest
  } = req.body;

  if (!agentName) {
    throw new ApiError(400, "Agent name and code are required");
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
    company: companyID
  });

  res
    .status(201)
    .json(new ApiResponse(201, agent, "Agent created successfully"));
});

// 🟢 Update Agent
exports.updateAgent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const agent = await Agent.findById(id);
  if (!agent) throw new ApiError(404, "Agent not found");

  let logoUrl = agent.logo;
  let registrationDocs = agent.registrationDocs;

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

  const updatedAgent = await Agent.findByIdAndUpdate(
    id,
    { ...req.body, logo: logoUrl, registrationDocs, banks: JSON.parse(req.body.banks) },
    { new: true }
  );

  res
    .status(200)
    .json(new ApiResponse(200, updatedAgent, "Agent updated successfully"));
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
  const clientAgent = req.user.clientAgent;
  console.log(req, "req.userrrr");

  if (!clientAgent) throw new ApiError(400, "ClientId ID is required");

  const agents = await Agent.find({ clientId: clientAgent, status: { $ne: "Delete" } });

  res
    .status(200)
    .json(new ApiResponse(200, agents, "Agents fetched successfully"));
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
  if (String(agent.clientId) !== String(req.user.clientAgent)) {
    throw new ApiError(403, "You are not permitted to perform this action");
  }

  // soft delete
  agent.status = "Delete";
  await agent.save();

  // send response
  res.status(200).json({
    success: true,
    message: "Agent deleted successfully",
    data: agent,
  });
});