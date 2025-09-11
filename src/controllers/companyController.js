const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const User = require('../models/User');

exports.createCompany = asyncHandler(async (req, res) => {
    const { namePrint, banks, ...rest } = req.body;
    if (!namePrint) throw new ApiError(400, 'Company name is required');
    
    let logoUrl = null;
    let registrationDocs = [];
    console.log("Request Files:", req.files);
    
    if (req?.files?.['logo'] && req?.files?.['logo'][0]) {
        logoUrl = req.files['logo'][0].location;
    }
   

  if (req?.files?.['registrationDocs']) {
    registrationDocs = req?.files['registrationDocs'].map(file => ({
      type: req.body.docType || 'Other',
      file: file.location,
      fileName: file.originalname
    }));
  }
//    res.send("Create Company Controller is working")
// res.send(req.body)

  const company = await Company.create({
    namePrint,
    ...rest,
    // banks: banks ? JSON.parse(banks) : [],
    banks: banks,
    logo: logoUrl || "",
    registrationDocs: registrationDocs || [],
  });

  res.status(201).json(new ApiResponse(201, company, "Company created successfully"));
});

// 🟢 Agent ke liye apne client ki saari companies laana
exports.getCompaniesForAgent = asyncHandler(async (req, res) => {

    const agentId = req.headers.agentid; // maan lo user login hai aur req.user me agent ka data hai
    // 1. Agent ka detail nikaalo
    console.log("Request User:", req.headers);
    const agent = await User.findById(agentId);
    
      if (!agent || agent.role !== 'Agent') {
            throw new ApiError(403, "Only agents can access this resource");
          }
        

  // 2. Agent ke parent (Client) ka ID lelo
  const clientId = agent.parent;
  if (!clientId) {
    throw new ApiError(404, "Client not found for this agent");
  }

  // 3. Client ki saari companies nikaalo
  const companies = await Company.find({ client: clientId });

  res.status(200).json(new ApiResponse(200, companies, "Companies fetched successfully"));
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