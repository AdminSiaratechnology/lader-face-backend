const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
// const upload = require('../config/s3');
router.get("/create",(req,res)=>{
    res.send("Company Route is working")
})

router.post(
  '/create',
//   upload.fields([
//     { name: 'logo', maxCount: 1 },
//     { name: 'registrationDocs', maxCount: 5 }
//   ]),
  companyController.createCompany
);
// router.get('/agent/companies', (req,res)=>{
//     res.send("Company Route is working")
// });
router.get('/agent/companies', companyController.getCompaniesForAgent);

module.exports = router;
