const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const upload = require("../config/s3");
router.get("/create", (req, res) => {
  res.send("Company Route is working");
});

router.post(
  "/create",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "registrationDocs", maxCount: 5 },
    { name: "brandingImages", maxCount: 5 },
  ]),
  companyController.createCompany
);
router.post(
  "/bulk",

  companyController.createBulkCompanies
);

// router.get('/agent/companies', (req,res)=>{
//     res.send("Company Route is working")
// });
router.get("/companies", companyController.getCompaniesForAgent);
router.get("/companies/:companyId", companyController.getCompanies);
router.get(
  "/companies/doc/pdf",
  companyController.generateCompanyDocumentationPDF
);
router.post("/assign-salesman", companyController.assignSalesman);
router.post("/set-access", companyController.setAccess);
router.get("/get-access", companyController.getAccess);
router.put(
  "/update/:id",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "registrationDocs", maxCount: 5 },
    { name: "brandingImages", maxCount: 5 },
  ]),
  companyController.updateCompany
);
router.delete("/delete/:id", companyController.deleteCompany);

module.exports = router;
