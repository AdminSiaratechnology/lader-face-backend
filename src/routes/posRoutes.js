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
      page = 1,
      limit = 10,
    } = req.query;

    // companyId is mandatory
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    // -------------------------
    // FILTER
    // -------------------------
    const filter = {
      companyId,
      held: false, // ❗ only completed bills
    };

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const skip = (Number(page) - 1) * Number(limit);

    // -------------------------
    // DATA + COUNT
    // -------------------------
    const [data, total] = await Promise.all([
      POS.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),

      POS.countDocuments(filter),
    ]);

    // -------------------------
    // STATS (Company Wise)
    // -------------------------
    const statsAgg = await POS.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalSales: { $sum: "$grandTotal" },

          cashSales: {
            $sum: {
              $cond: [{ $eq: ["$paymentMode", "cash"] }, "$grandTotal", 0],
            },
          },
          cardSales: {
            $sum: {
              $cond: [{ $eq: ["$paymentMode", "card"] }, "$grandTotal", 0],
            },
          },
          upiSales: {
            $sum: {
              $cond: [{ $eq: ["$paymentMode", "upi"] }, "$grandTotal", 0],
            },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data,
      stats: statsAgg[0] || {
        totalBills: 0,
        totalSales: 0,
        cashSales: 0,
        cardSales: 0,
        upiSales: 0,
      },
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    console.error("POS GET ERROR:", e);
    res.status(500).json({
      success: false,
      error: e.message,
    });
  }
});

module.exports = router;
