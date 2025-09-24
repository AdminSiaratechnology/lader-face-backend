const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const User = require('../models/User');

exports.createCompany = asyncHandler(async (req, res) => {
  console.log("Request Body:", req.body);
  // res.status(200).json({ message: "Create Company - Not Implemented" });
  try {
    
  
  const userId = req.user.id;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  console.log("Logged in user:", user);
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
if(user.role==="Client" || user.role==="Admin"){
  // Allow creating company
  console.log("banks:", JSON.parse(banks) || []);
  let code=await generateUniqueId(Company,"code")
  


  const company = await Company.create({
    namePrint,
    ...rest,
    code:code,
    client: user.role === 'Client' ? userId : user.clientAgent,
    banks: JSON.parse(banks) || [],
    logo: logoUrl || "",
    registrationDocs: registrationDocs || [],
  });

  res.status(201).json(new ApiResponse(201, company, "Company created successfully"));
} else {
  throw new ApiError(403, "Only clients and admins can create companies");
}
} catch (error) {
  console.error("Error creating company:", error);
  res.status(500).json({ error: "Internal server error" });
}}
);

// 🟢 Agent ke liye apne client ki saari companies laana
exports.getCompaniesForAgent = asyncHandler(async (req, res) => {
  const agentId = req.user.id; 
  console.log("Agent ID from req.user:", agentId);

  // 1. Agent nikaalo
  const agent = await User.findById(agentId);
  if (!agent) {
    throw new ApiError(404, "Agent not found");
  }

  // 2. Client ID nikaalo
  const clientId = agent?.clientAgent;
  if (!clientId) {
    throw new ApiError(404, "Client not found for this agent");
  }

  // 3. Query params lo
  const { search, status, sortBy, sortOrder
    , 
    limit = 3, page = 1 
  } = req.query;
  console.log(req.query,"reqqqqqq")
  console.log(search, status, sortBy, sortOrder,"fasdfafdasf",clientId)
  
  


  let filter = { client: clientId };

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

  console.log("Filter:", filter, "Sort:", sort, "Skip:", skip, "Limit:", perPage);

  // 4. DB se companies nikaalo
  const [companies, total] = await Promise.all([
    Company.find(filter).sort(sort)
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

exports.updateCompany = asyncHandler(async (req, res) => {

  const { id } = req.params;
  const user = await User.findById(req.user.id);

  if (!user) throw new ApiError(404, "User not found");

  const company = await Company.findById(id);
  if (!company) throw new ApiError(404, "Company not found");

  // 🔐 Ownership check
  if (user.role === "Client" && company.client.toString() !== user._id.toString()) {
    throw new ApiError(403, "You can only update your own companies");
  }

  // Logo update
  if (req?.files?.["logo"] && req?.files?.["logo"][0]) {
    req.body.logo = req.files["logo"][0].location;
  }

  // Docs update
  if (req?.files?.["registrationDocs"]) {
    req.body.registrationDocs = req.files["registrationDocs"].map((file) => ({
      type: req.body.docType || "Other",
      file: file.location,
      fileName: file.originalname,
    }));
  }

  const updatedCompany = await Company.findByIdAndUpdate(id, req.body, { new: true });

  res.status(200).json(new ApiResponse(200, updatedCompany, "Company updated successfully"));
});

// Get Companies
exports.getCompanies = asyncHandler(async (req, res) => {
  const { clientId } = req.query;

  const filter = { isDeleted: false }; // 🟢 sirf active companies
  if (clientId) filter.client = clientId;

  const companies = await Company.find(filter);

  res.status(200).json(new ApiResponse(200, companies, "Companies fetched successfully"));
});

// Delete Company (Soft Delete)
exports.deleteCompany = asyncHandler(async (req, res) => {
  console.log("Delete Company Request Params:", req.params);
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
  await company.save();

  res.status(200).json(new ApiResponse(200, null, "Company deleted successfully"));
});