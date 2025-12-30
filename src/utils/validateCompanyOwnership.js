const ApiError = require("./apiError");
const Company = require("../models/Company");

const validateCompanyOwnership = async ({ companyId, clientId }) => {
  const company = await Company.findOne({
    _id: companyId,
    client: clientId,
  }).lean();

 
  if (!company) {
    throw new ApiError(403, "Company does not belong to this client");
  }

  
  if (company.status !== "active") {
    throw new ApiError(
      403,
      `Company is ${company.status}. Please activate the company to continue`
    );
  }

  return company;
};

module.exports = validateCompanyOwnership;
