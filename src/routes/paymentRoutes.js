const express = require("express");
const router = express.Router();

const {
  createPayment,
  getPaymentsByOrder,
  getPayment,
  updatePayment,
  deletePayment,
  getPaymnetsForCustomer,
  getAllPaymentsByCompanyId
} = require("../controllers/paymentController");

const upload = require('../config/s3');

router.post(
  "/",
  upload.fields([{ name: "documents", maxCount: 10 }]),
  createPayment
);

// Get all payments for an order
router.get("/order/:orderId", getPaymentsByOrder);

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
