const express = require("express");
const {
  createCustomer,
  updateCustomer,
  getCustomersByCompany,
  getCustomerById,
  getCustomersByClient,
} = require("../controllers/coustomerController");
const upload = require("../config/s3");

const router = express.Router();

// Create customer
router.post("/",upload.fields([
   
    { name: "registrationDocs", maxCount: 5 },
  ]), createCustomer);

// Update customer
router.put("/:id", updateCustomer);

// Get all customers by company
router.get("/", getCustomersByClient);
// // Get all customers by company
// router.get("/", getCustomersByCompany);

// Get customer by id
router.get("/:id", getCustomerById);

module.exports = router;
