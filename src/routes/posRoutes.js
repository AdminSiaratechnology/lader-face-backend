// routes/POSs.js
const express = require("express");
const router = express.Router();
const POS = require("../models/Pos");

// 1. Create POS (complete bill)
router.post("/", async (req, res) => {
  try {
    const payload = { ...req.body, held: false };
    const pos = await POS.create(payload);
    res.json({ success: true, data: pos });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 2. Hold a bill (save as held)
router.post("/hold", async (req, res) => {
  try {
    const payload = { ...req.body, held: true };
    const POS = await POS.create(payload);
    res.json({ success: true, data: POS });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});
router.get("/", async (req, res) => {
  try {
    const {
      companyId,
      startDate,
      endDate,
      customerId,
      paymentType,
      billNumber,
      customer,
      status,
      page = 1,
      limit = 10,
    } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    const filter = { companyId };

    /* ---------- DATE RANGE (FIXED) ---------- */
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate + "T00:00:00"),
        $lte: new Date(endDate + "T23:59:59.999"),
      };
    }

    /* ---------- CUSTOMER NAME ---------- */
    if (customer) {
      filter["customer.name"] = {
        $regex: customer.trim(),
        $options: "i",
      };
    }

    /* ---------- BILL NUMBER ---------- */
    if (billNumber) {
      filter.billNumber = billNumber.trim();
    }

    /* ---------- PAYMENT TYPE (REGEX + i) ---------- */
    if (paymentType) {
      const safePayment = paymentType.trim().toUpperCase();

      filter["paymentInfo.paymentType"] = {
        $regex: `^${safePayment}$`,
        $options: "i",
      };
    }

    /* ---------- CUSTOMER ID ---------- */
    if (customerId) {
      filter["customer.customerId"] = customerId;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      POS.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      POS.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});





module.exports = router;
