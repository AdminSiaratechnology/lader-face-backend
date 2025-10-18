const express = require("express");
const {
  createCustomer,
  updateCustomer,
  getCustomersByCompany,
  getCustomerById,
  getCustomersByClient,
  deleteCustomer,
  createBulkCustomers
  
} = require("../controllers/coustomerController");
const upload = require("../config/s3");

const router = express.Router();

// Create customer
router.post("/",upload.fields([
   
    { name: "registrationDocs", maxCount: 5 },
  ]), createCustomer);

  //bulk create customers
  router.post("/bulk", createBulkCustomers);

// Update customer
router.put("/:id",upload.fields([
   
    { name: "registrationDocs", maxCount: 5 },
  ]),  updateCustomer);

// Get all customers by company
router.get("/", getCustomersByClient);
// // Get all customers by company
// router.get("/", getCustomersByCompany);

// Get customer by id
router.get("/:id", getCustomerById);
router.delete("/:id",deleteCustomer)

module.exports = router;
