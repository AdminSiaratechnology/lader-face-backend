const express = require("express");
const router = express.Router();

const {
  createCoupon,
  getAllCouponsByCompany,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  getBogoCoupons,
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

router.get("/bogo/:companyId", getBogoCoupons);

module.exports = router;
