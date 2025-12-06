const express = require("express");
const router = express.Router();

const {
  createPayment,
  getPaymentsByOrder,
  getPayment,
  updatePayment,
  deletePayment,
  getPaymnetsForCustomer,
  getAllPaymentsByCompanyId,
  getPaymentReport,
  getCustomerWiseReport
  
} = require("../controllers/paymentController");

const upload = require('../config/s3');

router.post(
  "/",
  upload.fields([{ name: "documents", maxCount: 10 }]),
  createPayment
);

// Get all payments for an order
router.get("/order/:orderId", getPaymentsByOrder);
router.get("/report",getPaymentReport)
// routes/reportRoutes.js
router.get("/report/customer-wise", getCustomerWiseReport);

// Get single payment
router.get("/:paymentId", getPayment);

// Update payment
router.put("/:paymentId",  upload.fields([{ name: "documents", maxCount: 10 }]), updatePayment);

// Delete payment
router.delete("/:paymentId", deletePayment);

// Get payments for a customer
router.get("/customer/:customerId", getPaymnetsForCustomer);

router.get("/company/:companyId", getAllPaymentsByCompanyId); 
module.exports = router;
