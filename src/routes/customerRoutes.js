const express = require("express");
const {
  createCustomer,
  updateCustomer,
  getCustomersByCompany,
  getCustomerById,
} = require("../controllers/customerController");

const router = express.Router();

// Create customer
router.post("/", createCustomer);

// Update customer
router.put("/:id", updateCustomer);

// Get all customers by company
router.get("/", getCustomersByCompany);

// Get customer by id
router.get("/:id", getCustomerById);

module.exports = router;
