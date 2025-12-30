const ApiError = require("../utils/apiError");
const Company = require("../models/Company");

const validateCompany = async (req, res, next) => {
  try {
    const clientId = req?.user?.clientID;
    const companyId =
      req?.body?.companyId || req?.query?.companyId || req?.params?.companyId ||req?.body?.company || req?.query?.company || req?.params?.company;
      console.log(companyId,clientId,"clientIdclientId")

    if (!companyId) {
      throw new ApiError(400, "Company ID is required");
    }

    const company = await Company.findOne({
      _id: companyId,
      client: clientId,
    });

    if (!company) {
      throw new ApiError(403, "Company does not belong to this client");
    }

    if (company.status !== "active") {
      throw new ApiError(
        403,
        `Company is ${company.status}. Please activate the company to continue`
      );
    }

    // 🔥 Attach verified company to request
    req.company = company;

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = validateCompany;
