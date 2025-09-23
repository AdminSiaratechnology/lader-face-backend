const express = require("express");
const {
  createVendor,
  updateVendor,
  getVendorsByCompany,
  getVendorById,
  getVendorsByClient,
  deleteVendor,
  
} = require("../controllers/vendorController");
const upload = require("../config/s3");

const router = express.Router();

// Create vendor
router.post("/",upload.fields([
   
    { name: "registrationDocs", maxCount: 5 },
  ]), createVendor);

// Update vendor
router.put("/:id",upload.fields([
   
    { name: "registrationDocs", maxCount: 5 },
  ]),  updateVendor);

// Get all vendors by company
router.get("/", getVendorsByClient);
// // Get all vendors by company
// router.get("/", getVendorsByCompany);

// Get vendor by id
router.get("/:id", getVendorById);
router.delete("/:id",deleteVendor)

module.exports = router;