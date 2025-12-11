const express = require("express");
const router = express.Router();

const {
  createCoupon,
  getAllCouponsByCompany,
  getCouponById,
  updateCoupon,
  deleteCoupon,
} = require("../controllers/couponController");

// CREATE
router.post("/", createCoupon);

router.get("/all/:companyId", getAllCouponsByCompany);

// GET BY ID
router.get("/:id", getCouponById);

// UPDATE
router.put("/:id", updateCoupon);

// DELETE
router.delete("/:id", deleteCoupon);

module.exports = router;
