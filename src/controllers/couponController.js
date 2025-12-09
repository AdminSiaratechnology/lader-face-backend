const { CouponModel } = require("../models/Coupon");

//
// 🔹 Helper: basic required fields validation
//
const validateRequiredFields = (data) => {
  const requiredFields = ["company", "name", "validFrom", "validTo"];

  for (let field of requiredFields) {
    if (!data[field] || data[field].toString().trim() === "") {
      return `${field} is required`;
    }
  }
  return null;
};
async function generateCouponCode() {
  let code;
  let exists = true;

  while (exists) {
    code = "CPN" + Math.floor(100000 + Math.random() * 900000); // Random 6 digit code
    exists = await CouponModel.findOne({ code });
  }

  return code;
}

//
// 🔹 Helper: BOGO validation (if bogoConfig is present)
//
const validateBogoConfig = (bogoConfig) => {
  if (!bogoConfig) return null; // if not a BOGO coupon, skip

  const { buyQty, getQty, buyProducts, freeProducts, freeMode } = bogoConfig;

  if (!buyQty || buyQty <= 0) {
    return "BOGO: buyQty must be greater than 0";
  }

  if (!getQty || getQty <= 0) {
    return "BOGO: getQty must be greater than 0";
  }

  if (!Array.isArray(buyProducts) || buyProducts.length === 0) {
    return "BOGO: at least one product must be selected to buy";
  }

  if (freeMode === "different") {
    if (!Array.isArray(freeProducts) || freeProducts.length === 0) {
      return "BOGO: please select free products when freeMode is 'different'";
    }
  }

  return null;
};

const computeStatus = (validFrom, validTo) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const from = new Date(validFrom);
  const to = new Date(validTo);

  if (today < from) return "inactive";   // not started
  if (today > to) return "expired";      // date passed
  return "active";                       // running
};

//
// ============================
// CREATE COUPON
// ============================
exports.createCoupon = async (req, res) => {
  try {
    const data = req.body;

    // 1️⃣ Auto-generate code if not provided
    if (!data.code || data.code.trim() === "") {
      data.code = await generateCouponCode(); 
    }

    const coupon = await CouponModel.create(data);
    res.json({ success: true, data: coupon });

  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, message: err.message });
  }
};






// GET ALL COUPONS (with pagination + search + filters)


exports.getAllCouponsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 10, search = "", status } = req.query;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    const query = { company: companyId };

    // 🔍 SEARCH
    if (search.trim() !== "") {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // ⭐ STATUS FILTER (CORRECT LOGIC)
    if (status === "delete") {
      // show only delete coupons
      query.status = "delete";
    } else {
      // hide delete for all other filters
      query.status = { $ne: "delete" };

      // apply the selected status if not 'all'
      if (status && status !== "all") {
        query.status = status;
      }
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [coupons, total] = await Promise.all([
      CouponModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      CouponModel.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: coupons,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error fetching coupons",
      error: err.message,
    });
  }
};


//
// ============================
// GET BY ID
// ============================
exports.getCouponById = async (req, res) => {
  try {
    const coupon = await CouponModel.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: coupon,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error fetching coupon",
      error: err.message,
    });
  }
};

//
// ============================
// UPDATE COUPON
// ============================
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
console.log(data)
    // if (data.validFrom && data.validTo) {
    //   data.status = computeStatus(data.validFrom, data.validTo);
    // }

    const updated = await CouponModel.findByIdAndUpdate(id, data, { new: true });

    res.json({ success: true, data: updated });
   
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


//
// ============================
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    await CouponModel.findByIdAndUpdate(id, {
      status: "delete"
    });

    return res.json({ success: true, message: "Coupon delete (soft)" });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

