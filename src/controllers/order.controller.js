const Order = require("../models/order.model");
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const Company = require("../models/Company");
const Cart = require("../models/Cart");
const { Worker } = require("worker_threads");
const path = require("path");
const { logAudit } = require("../utils/orderAuditLog");
const calculateChanges = require("../utils/calculateChanges");

// ✅ Create Order
exports.createOrder = asyncHandler(async (req, res) => {
  try {
    const { companyId, customerId, shippingAddress, items, orderSource } =
      req.body;
    const clientId = req.user?.clientID;
    const userId = req.user?.id;

    console.log("🧾 Creating order...");

    if (
      !companyId ||
      !clientId ||
      !customerId ||
      !userId ||
      !items?.length ||
      !orderSource
    ) {
      throw new ApiError(400, "Missing required fields");
    }

    for (const item of items) {
      if (!item.productId || !item.quantity || !item.price) {
        throw new ApiError(
          400,
          "Each item must include productId, quantity, and price"
        );
      }

      // Ensure discount is not greater than total
      if (item.discount && item.discount > item.total) {
        item.discount = item.total;
      }
    }

    const company = await Company.findById(companyId).lean();
    if (!company) throw new ApiError(404, "Company not found");

    const isAutoApproved = company.autoApprove === true;
    console.log(req.body);

    const subtotal = items.reduce((acc, item) => acc + (item.total || 0), 0);
    const totalDiscount = items.reduce(
      (acc, item) => acc + (item.discount || 0),
      0
    );
    let grandTotal = subtotal - totalDiscount;

    // prevent negative total
    if (grandTotal < 0) grandTotal = 0;

    const orderData = {
      companyId,
      clientId,
      customerId,
      userId,
      shippingAddress: shippingAddress || {},
      items,
      discount: totalDiscount,
      grandTotal,
      payment: {
        mode: "cash",
        status: "pending",
      },
      orderSource,
      status: isAutoApproved ? "approved" : "pending",
    };

    const order = await Order.create(orderData);
    console.log("✅ Order created with ID:", order._id);
    logAudit(
      order._id,
      "created",
      userId,
      clientId,
      companyId,
      null,
      order.toObject()
    ); // No await!

    // ✅ Populate limited customer fields
    const populatedOrder = await Order.findById(order._id)
      .populate({
        path: "customerId",
        select: "customerName emailAddress phone country currency",
      })
      .lean();
    // In createOrder (after order.save()):

    // 🧵 Background Cart Clear Worker
    const workerPath = path.join(__dirname, "../workers/clearCartWorker.js");

    new Worker(workerPath, {
      workerData: {
        clientId,
        companyId,
        userId,
        mongoUri: process.env.MONGODB_URI,
      },
    })
      .on("message", (msg) => {
        if (msg.success) console.log("✅ Cart cleared successfully (worker)");
        else console.error("❌ Worker failed:", msg.error);
      })
      .on("error", (err) => console.error("💥 Worker thread error:", err))
      .on("exit", (code) => {
        if (code !== 0) console.error(`⚠️ Worker exited with code ${code}`);
      });
    console.log("🧾 Order created with ID:", populatedOrder);

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          populatedOrder,
          `Order created successfully (${order.status})`
        )
      );
  } catch (error) {
    console.error("❌ Error creating order:", error);
    if (error instanceof ApiError) {
      return res
        .status(error.statusCode || 400)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }
    return res
      .status(500)
      .json(new ApiResponse(500, null, "Internal server error", error.message));
  }
});

//updateOrderStatus
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const clientId = req.user.clientID;
  const userId = req.user.id;
  if (!clientId || !userId) {
    return res
      .status(401)
      .json(
        new ApiResponse(
          401,
          null,
          "Unauthorized access — user credentials missing"
        )
      );
  }
  if (!status || !id) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Invalid order ID or status"));
  }

  const order = await Order.findById(id);
  if (!order) throw new ApiError(404, "Order not found");

  const oldData = order.toObject();

  order.status = status;
  await order.save();

  const newData = order.toObject();
  const changes = calculateChanges(oldData, newData);

  logAudit(
    order._id,
    "status_updated",
    userId,
    clientId,
    order.companyId,
    oldData,
    newData,
    changes
  );

  res.status(200).json(new ApiResponse(200, order, "Status updated"));
});

exports.updateOrderDetails = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const {
      shippingAddress,
      items = [],
      remarks,
      payment,
      updatedBy,
    } = req.body;

    const clientId = req.user?.clientID;
    const userId = req.user?.id;

    if (!clientId || !userId) {
      throw new ApiError(401, "Unauthorized access — user credentials missing");
    }

    // 1️⃣ Find order
    const order = await Order.findById(id);
    if (!order) throw new ApiError(404, "Order not found");

    // 2️⃣ Block update for restricted status
    if (["confirmed", "approved", "cancelled"].includes(order.status)) {
      throw new ApiError(403, `${order.status} orders cannot be modified`);
    }

    // 3️⃣ UPDATE ITEMS (NO NEW PRODUCT ALLOWED)
    if (items.length) {
      const oldProductIds = order.items.map((i) => i.productId.toString());
      const newProductIds = items.map((i) => i.productId.toString());

      // ❌ Check if any new product is being added
      const extraProducts = newProductIds.filter(
        (pid) => !oldProductIds.includes(pid)
      );

      if (extraProducts.length > 0) {
        throw new ApiError(
          400,
          "New products cannot be added to an existing order"
        );
      }

      // 🔍 Keep only products that still exist in new payload
      const remainingIds = oldProductIds.filter((pid) =>
        newProductIds.includes(pid)
      );

      // 🔄 Update quantities/prices/discounts
      order.items = order.items
        .filter((i) => remainingIds.includes(i.productId.toString()))
        .map((old) => {
          const updated = items.find(
            (i) => i.productId.toString() === old.productId.toString()
          );

          if (!updated) return old;

          const quantity = updated.quantity ?? old.quantity;
          const price = updated.price ?? old.price;
          const discount = updated.discount ?? old.discount ?? 0;

          // ❌ Remove if quantity 0
          if (quantity <= 0) return null;

          return {
            ...old.toObject(),
            quantity,
            price,
            discount,
            total: price * quantity - discount,
          };
        })
        .filter(Boolean);
    }

    // ❌ Must have at least 1 item
    if (!order.items || order.items.length === 0) {
      throw new ApiError(400, "Order must contain at least one product");
    }

    // 4️⃣ Update shipping address
    if (shippingAddress) {
      order.shippingAddress = {
        ...order.shippingAddress,
        ...shippingAddress,
      };
    }

    // 5️⃣ Remarks and payment
    if (remarks) order.remarks = remarks;
    if (payment) order.payment = { ...order.payment, ...payment };

    order.updatedBy = updatedBy || userId;

    // 6️⃣ Recalculate totals
    order.subtotal = order.items.reduce(
      (acc, i) => acc + i.price * i.quantity,
      0
    );

    order.discount = order.items.reduce((acc, i) => acc + (i.discount || 0), 0);

    order.grandTotal = order.subtotal - order.discount;

    // 7️⃣ Save
    await order.save();

    res
      .status(200)
      .json(new ApiResponse(200, order, "Order details updated successfully"));
  } catch (error) {
    console.error("❌ Error updating order details:", error);

    if (error instanceof ApiError) {
      return res
        .status(error.statusCode || 400)
        .json(new ApiResponse(error.statusCode, null, error.message));
    }

    res
      .status(500)
      .json(new ApiResponse(500, null, "Internal server error", error.message));
  }
});

// ✅ Update Order
exports.updateOrder = async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedOrder)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    res.json({
      success: true,
      message: "Order updated successfully",
      updatedOrder,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get Order by ID
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "companyId clientId customerId userId items.productId",
      "name email images remarks"
    );
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ Get Orders by Company & Client (with filters + pagination)
exports.getOrders = async (req, res) => {
  console.log("getOrders");
  try {
    const {
      companyId,
      clientId,
      status,
      paymentStatus,
      page = 1,
      limit = 10,
    } = req.query;
    const userId = req.user?.id;
    const role = req.user?.role;

    const filter = {};
    if (companyId) filter.companyId = companyId;
    if (clientId) filter.clientId = clientId;
    if (status) filter.status = status;
    if (paymentStatus) filter["payment.status"] = paymentStatus;
    if (role === "Salesman" || role === "Customer") {
      filter.userId = userId;
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("customerId", "customerName emailAddress contactPerson")
        .populate("items.productId", "name price remarks")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(filter),
    ]);

    res.json({
      success: true,
      totalRecords: total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      orders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrdersByCompanyId = async (req, res) => {
  console.log("📦 Fetching Orders by Company ID");

  try {
    const { companyId } = req.params;
    const clientId = req.user?.clientID;
    const userId = req.user?.id;
    const role = req.user?.role;

    const {
      search = "",
      status,
      paymentStatus,
      page = 1,
      limit = 10,
    } = req.query;

    // 🔒 Basic Validations
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid companyId format",
      });
    }

    if (!clientId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing client or user info",
      });
    }

    // 🧾 BASE FILTER
    const filter = { companyId, clientId };

    // 🔐 Extra Rule → If Salesman OR Customer, match userId also
    if (role === "Salesman" || role === "Customer") {
      filter.userId = userId;
    }

    // 📌 Status Filters
    if (status) filter.status = status;
    if (paymentStatus) filter["payment.status"] = paymentStatus;
if (search && search.trim() !== "") {
  console.log("🔎 Searching orders with:", search);

  console.log("➡️ Looking for customers with name like:", search);
  const customerMatches = await Customer.find(
    {
      customerName: { $regex: search, $options: "i" },
  company: companyId,       clientId,
    },
    "_id customerName"
  );

  console.log("🟩 Customers found matching search:", customerMatches);

  const customerIds = customerMatches.map((c) => c._id);

  console.log("🆔 Extracted customer IDs:", customerIds);

  filter.$or = [
    { orderCode: { $regex: search, $options: "i" } },
    { customerId: { $in: customerIds } },
  ];

  console.log("📌 Final $or search filter:", filter.$or);
}


    console.log(filter);
    const skip = (page - 1) * limit;

    // 📦 Fetch Data
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate(
          "customerId",
          "emailAddress customerName zipCode country city state addressLine1 addressLine2"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(filter),
    ]);
    // 🔥 Get order status counts (pending, completed, approved)
    const statusCounts = await Order.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          clientId: new mongoose.Types.ObjectId(clientId),
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Convert aggregation result to normal object
    let orderStats = {
      pending: 0,
      completed: 0,
      approved: 0,
      cancelled: 0,
    };

    statusCounts.forEach((s) => {
      orderStats[s._id] = s.count;
    });

    return res.status(200).json({
      success: true,
      totalRecords: total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      limit: parseInt(limit),
      orders,
      counts: {
        pending: orderStats.pending,
        completed: orderStats.completed,
        approved: orderStats.approved,
        cancelled: orderStats.cancelled,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getOrdersByUser = async (req, res) => {
  console.log("📦 Fetching Orders by Company ID");

  try {
    const { companyId } = req.params;
    const clientId = req.user?.clientID; // ✅ from authenticated user
    const userId = req.user?.id;
    const { status, paymentStatus, page = 1, limit = 10 } = req.query;

    // 🔒 Validate required and ObjectId
    if (!companyId) {
      return res
        .status(400)
        .json({ success: false, message: "companyId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid companyId format" });
    }

    if (!clientId || !userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing client or user info",
      });
    }

    // 🧾 Build Filter
    const filter = { companyId, clientId, userId };
    if (status) filter.status = status;
    if (paymentStatus) filter["payment.status"] = paymentStatus;

    const skip = (page - 1) * limit;

    // 📦 Fetch Orders with Pagination
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(filter),
    ]);

    // 🧮 Response
    return res.status(200).json({
      success: true,
      totalRecords: total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      orders,
    });
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getStateWiseSales = async (req, res) => {
  try {
    const { companyId } = req.params;
    const clientId = req.user?.clientID;
    const role = req.user?.role;
    const userId = req.user?.id;
    const customerId = req.user?.customerId; // For customer role

    let match = { companyId: new mongoose.Types.ObjectId(companyId) };

    if (role === "Admin") {
      // Full access
    } else if (role === "Salesman") {
      match.userId = new mongoose.Types.ObjectId(userId);
    } else if (role === "Customer") {
      match.customerId = new mongoose.Types.ObjectId(customerId);
    } else {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (role !== "Admin") {
      match.clientId = new mongoose.Types.ObjectId(clientId);
    }

    const data = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$shippingAddress.state",
          totalSales: { $sum: "$grandTotal" },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { totalSales: -1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPartyWiseSales = async (req, res) => {
  try {
    const { companyId } = req.params;
    const clientId = req.user?.clientID;

    const data = await Order.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          clientId: new mongoose.Types.ObjectId(clientId),
        },
      },
      {
        $group: {
          _id: "$customerId",
          totalSales: { $sum: "$grandTotal" },
          totalOrders: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "customers",
          let: { customerId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$customerId"] } } },
            {
              $project: {
                _id: 1,
                customerName: 1,
                contactPerson: 1,
                emailAddress: 1,
                country: 1,
                currency: 1,
              },
            },
          ],
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      { $sort: { totalSales: -1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSalesmanWiseSales = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { period = "month" } = req.query; // day, week, month, year
    const clientId = req.user?.clientID;

    // Calculate date range based on period
    const now = new Date();
    let startDate, endDate;

    switch (period) {
      case "day":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999
        );
        break;
      case "week":
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // adjust when day is sunday
        startDate = new Date(now.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
    }

    const matchConditions = {
      companyId: new mongoose.Types.ObjectId(companyId),
      status: { $ne: "cancelled" }, // Exclude cancelled orders
    };

    // Add clientId if available
    if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
      matchConditions.clientId = new mongoose.Types.ObjectId(clientId);
    }

    // Add date filter
    matchConditions.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };

    const data = await Order.aggregate([
      {
        $match: matchConditions,
      },
      {
        $group: {
          _id: "$userId",
          totalSales: { $sum: "$grandTotal" },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: "$grandTotal" },
          // Additional metrics
          totalItems: { $sum: { $size: "$items" } },
          lastOrderDate: { $max: "$createdAt" },
        },
      },
      {
        $lookup: {
          from: "users",
          let: { salesmanId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$salesmanId"] } } },
            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                email: 1,
                mobile: 1,
                role: 1,
                status: 1,
              },
            },
          ],
          as: "salesman",
        },
      },
      { $unwind: "$salesman" },
      {
        $project: {
          _id: 1,
          totalSales: 1,
          totalOrders: 1,
          averageOrderValue: 1,
          totalItems: 1,
          lastOrderDate: 1,
          salesman: 1,
          status: "$salesman.status",
          salesPerOrder: { $divide: ["$totalSales", "$totalOrders"] },
        },
      },
      { $sort: { totalSales: -1 } },
    ]);

    res.json({
      success: true,
      data,
      period,
      dateRange: {
        start: startDate,
        end: endDate,
      },
    });
  } catch (err) {
    console.error("Error in salesman wise sales:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTodaySales = async (req, res) => {
  const { companyId } = req.params;
  const clientId = req.user?.clientID;
  const userId = req.user?.id;
  const role = req.user?.role;
  if (!companyId || !clientId || !userId || role === "Customer") {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const data = await Order.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          clientId: new mongoose.Types.ObjectId(clientId),
          createdAt: { $gte: start, $lte: end },
          ...(role !== "Salesman" && {
            userId: new mongoose.Types.ObjectId(userId),
          }),
          ...(role !== "Customer" && {
            userId: new mongoose.Types.ObjectId(userId),
          }),
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: data[0] || { totalSales: 0, totalOrders: 0 },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Get sales data for a specific date range
exports.getSalesByDateRange = async (req, res) => {
  const userId = req.user?.id;
  const role = req.user?.role;

  try {
    const { companyId } = req.params;
    const clientId = req.user?.clientID;
    const { fromDate, toDate } = req.query;
    if (!companyId || !clientId || !userId || role === "Customer") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    // Validation
    if (!companyId || !clientId) {
      return res.status(400).json({
        success: false,
        message: "Missing companyId or clientId",
      });
    }

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide fromDate and toDate in query params",
      });
    }

    // Parse and set date range
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "fromDate cannot be greater than toDate",
      });
    }

    console.log("Date Range:", { start, end });

    const data = await Order.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          clientId: new mongoose.Types.ObjectId(clientId),
          createdAt: { $gte: start, $lte: end },
          ...(role !== "Salesman" && {
            userId: new mongoose.Types.ObjectId(userId),
          }),
          ...(role !== "Customer" && {
            userId: new mongoose.Types.ObjectId(userId),
          }),
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          totalOrders: { $sum: 1 },
          totalDiscount: { $sum: "$discount" },
          totalTax: { $sum: "$tax" },
        },
      },
      {
        $project: {
          _id: 0,
          totalSales: 1,
          totalOrders: 1,
          totalDiscount: 1,
          totalTax: 1,
          averageOrderValue: {
            $cond: {
              if: { $gt: ["$totalOrders", 0] },
              then: { $divide: ["$totalSales", "$totalOrders"] },
              else: 0,
            },
          },
        },
      },
    ]);

    const result = data[0] || {
      totalSales: 0,
      totalOrders: 0,
      totalDiscount: 0,
      totalTax: 0,
      averageOrderValue: 0,
    };

    res.json({
      success: true,
      data: result,
      dateRange: {
        from: start,
        to: end,
      },
    });
  } catch (err) {
    console.error("Date range sales error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getMonthlySalesComparison = async (req, res) => {
  try {
    const { companyId } = req.params;
    const clientId = req.user?.clientID;
    const now = new Date();

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59
    );

    const [thisMonth, prevMonth] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            companyId: new mongoose.Types.ObjectId(companyId),
            clientId: new mongoose.Types.ObjectId(clientId),
            createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$grandTotal" },
            totalOrders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            companyId: new mongoose.Types.ObjectId(companyId),
            clientId: new mongoose.Types.ObjectId(clientId),
            createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$grandTotal" },
            totalOrders: { $sum: 1 },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        thisMonth: thisMonth[0] || { totalSales: 0, totalOrders: 0 },
        prevMonth: prevMonth[0] || { totalSales: 0, totalOrders: 0 },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTopCustomers = async (req, res) => {
  try {
    const { companyId } = req.params;
    const clientId = req.user?.clientID;
    const { limit = 5 } = req.query;
    const role = req.user?.role;
    const userId = req.user?.id;
    if (role === "Customer") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const data = await Order.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          clientId: new mongoose.Types.ObjectId(clientId),
          ...(role !== "Salesman" && {
            userId: new mongoose.Types.ObjectId(userId),
          }),
        },
      },
      {
        $group: {
          _id: "$customerId",
          totalSales: { $sum: "$grandTotal" },
        },
      },
      { $sort: { totalSales: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: "customers",
          let: { customerId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$customerId"] } } },
            {
              $project: {
                _id: 1,
                customerName: 1,
                contactPerson: 1,
                emailAddress: 1,
                country: 1,
                currency: 1,
              },
            },
          ],
          as: "customer",
        },
      },
      { $unwind: "$customer" },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
exports.getTopProducts = async (req, res) => {
  try {
    const { companyId } = req.params;
    const clientId = req.user?.clientID;
    const userId = req.user?.id;

    const role = req.user?.role;
    const { limit = 5, period = "month" } = req.query;
    // Logging for debug
    console.log("Company ID:", companyId);
    console.log("Client ID:", clientId);
    console.log("User role:", role);
    console.log("Period:", period);
    if (!companyId || (role !== "Admin" && !clientId)) {
      return res.status(400).json({
        success: false,
        message: "Missing companyId or clientId",
      });
    }
    // Calculate date range based on period
    const now = new Date();
    let startDate, endDate;
    endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // End of day
    switch (period) {
      case "day":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        const dayOfWeek = now.getDay();
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - dayOfWeek
        );
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const dateMatch = {
      createdAt: {
        // Assuming the field is createdAt; change if it's orderDate
        $gte: startDate,
        $lte: endDate,
      },
    };
    console.log(
      "Date Range for aggregation:",
      { startDate, endDate },
      role,
      userId
    );
    const topProducts = await Order.aggregate([
      // Step 1: Match orders for the specific company, client (if not admin), and date range
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          clientId: new mongoose.Types.ObjectId(clientId),
          ...(role !== "Salesman" && {
            userId: new mongoose.Types.ObjectId(userId),
          }),
          ...(role !== "Customer" && {
            userId: new mongoose.Types.ObjectId(userId),
          }),
          ...dateMatch,
        },
      },

      // Step 2: Unwind items array to process each item separately
      { $unwind: "$items" },

      // Step 3: Group by productId and calculate totals
      {
        $group: {
          _id: "$items.productId",
          totalQuantity: { $sum: "$items.quantity" },
          totalSales: { $sum: "$items.total" },
          totalOrders: { $sum: 1 },
        },
      },

      // Step 4: Sort by totalSales (descending) for revenue-based ranking
      { $sort: { totalSales: -1 } },

      // Step 5: Limit results
      { $limit: parseInt(limit) },

      // Step 6: Lookup stockitems (first level)
      {
        $lookup: {
          from: "stockitems",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },

      // Step 7: Unwind product details
      {
        $unwind: {
          path: "$productDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Step 8: Lookup products collection (nested productId) - keeping as is, though may not be used
      {
        $lookup: {
          from: "products", // ye collection name check kar lo
          localField: "productDetails.productId",
          foreignField: "_id",
          as: "nestedProductDetails",
        },
      },

      // Step 9: Unwind nested product details
      {
        $unwind: {
          path: "$nestedProductDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Step 10: Project final structure with limited fields
      {
        $project: {
          _id: 0,
          productId: "$_id",
          totalQuantity: 1,
          totalSales: 1,
          totalOrders: 1,
          product: {
            _id: "$productDetails._id",
            ItemName: "$productDetails.ItemName",
            ItemCode: "$productDetails.ItemCode",
            Group: "$productDetails.Group",
            Category: "$productDetails.Category",
            MRP: "$productDetails.MRP",
            Price: "$productDetails.Price",
            Discount: "$productDetails.Discount",
            TotalQty: "$productDetails.TotalQty",
            status: "$productDetails.status",
            // Nested product details populated (if needed)
            productDetails: {
              _id: "$nestedProductDetails._id",
              name: "$nestedProductDetails.name",
              description: "$nestedProductDetails.remarks",
              image: "$nestedProductDetails.images",
              // add jo bhi fields chahiye
            },
          },
        },
      },
    ]);
    console.log("Top Products:", JSON.stringify(topProducts, null, 2));
    res.json({
      success: true,
      data: topProducts,
      count: topProducts.length,
      period: period,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (err) {
    console.error("Aggregation error:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getTotalPayments = async (req, res) => {
  try {
    const { companyId, clientId } = req.query;

    const data = await Order.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          clientId: new mongoose.Types.ObjectId(clientId),
          "payment.status": "completed",
        },
      },
      { $group: { _id: null, totalPayment: { $sum: "$payment.amountPaid" } } },
    ]);

    res.json({ success: true, data: data[0] || { totalPayment: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/orders/salesman-personal-stats/:companyId
 * Query: ?period=day|week|month|year
 */
exports.getSalesmanPersonalStats = asyncHandler(async (req, res) => {
  const { companyId } = req.params;
  const { period = "month" } = req.query;
  const userId = req.user?.id;

  // ---------- 1. Validation ----------
  if (!companyId || !userId) {
    throw new ApiError(400, "companyId and authenticated user are required");
  }

  const companyObjId = new mongoose.Types.ObjectId(companyId);
  const salesmanObjId = new mongoose.Types.ObjectId(userId);

  // ---------- 2. Date ranges ----------
  const now = new Date();

  // Today
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  // Last month
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
    999
  );

  // Period filter (day/week/month/year)
  let periodFilter = {};
  if (period === "day") {
    periodFilter = { createdAt: { $gte: startOfToday } };
  } else if (period === "week") {
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek); // Sunday = 0
    startOfWeek.setHours(0, 0, 0, 0);
    periodFilter = { createdAt: { $gte: startOfWeek } };
  } else if (period === "month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    periodFilter = { createdAt: { $gte: startOfMonth } };
  } else if (period === "year") {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    periodFilter = { createdAt: { $gte: startOfYear } };
  }

  // ---------- 3. Parallel aggregations ----------
  const [periodAgg, todayAgg, lastMonthAgg, totalAgg] = await Promise.all([
    // 1. Stats for selected period
    Order.aggregate([
      {
        $match: {
          companyId: companyObjId,
          userId: salesmanObjId,
          ...periodFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          totalOrders: { $sum: 1 },
          totalItems: { $sum: { $size: "$items" } },
        },
      },
    ]),

    // 2. Today's sales
    Order.aggregate([
      {
        $match: {
          companyId: companyObjId,
          userId: salesmanObjId,
          createdAt: { $gte: startOfToday },
        },
      },
      { $group: { _id: null, todaySales: { $sum: "$grandTotal" } } },
    ]),

    // 3. Last month's sales
    Order.aggregate([
      {
        $match: {
          companyId: companyObjId,
          userId: salesmanObjId,
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        },
      },
      { $group: { _id: null, lastMonthSales: { $sum: "$grandTotal" } } },
    ]),

    // 4. All-time total
    Order.aggregate([
      {
        $match: {
          companyId: companyObjId,
          userId: salesmanObjId,
        },
      },
      { $group: { _id: null, totalSales: { $sum: "$grandTotal" } } },
    ]),
  ]);

  // ---------- 4. Normalise results ----------
  const periodStats = periodAgg[0] || {
    totalSales: 0,
    totalOrders: 0,
    totalItems: 0,
  };
  const averageOrderValue =
    periodStats.totalOrders > 0
      ? periodStats.totalSales / periodStats.totalOrders
      : 0;

  const responseData = {
    // Period-specific
    totalSales: periodStats.totalSales,
    totalOrders: periodStats.totalOrders,
    totalItems: periodStats.totalItems,
    averageOrderValue,

    // Cross-period
    todaySales: todayAgg[0]?.todaySales ?? 0,
    lastMonthSales: lastMonthAgg[0]?.lastMonthSales ?? 0,
    totalSalesAllTime: totalAgg[0]?.totalSales ?? 0,
  };

  // ---------- 5. Send response ----------
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        responseData,
        "Salesman personal stats fetched successfully"
      )
    );
});

exports.getMyOrders = async (req, res) => {
  try {
    const { companyId, customerId } = req.params;
    const role = req.user?.role;

    if (role === "customer" && req.user.customerId !== customerId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const filter = {
      companyId: new mongoose.Types.ObjectId(companyId),
      customerId: new mongoose.Types.ObjectId(customerId),
    };

    const orders = await Order.find(filter)
      .populate("items.productId", "ItemName")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const { companyId } = req.params;
    const role = req.user?.role;

    if (role !== "customer" && role !== "admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const products = await StockItem.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      status: "active",
    }).select("ItemName ItemCode Price MRP Group Category _id");

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCustomerSalesStats = asyncHandler(async (req, res) => {
  const { companyId, customerId } = req.query;

  // ---------- 1. Validation ----------
  if (!companyId || !customerId) {
    throw new ApiError(400, "Both companyId and customerId are required");
  }

  const companyObjId = new mongoose.Types.ObjectId(companyId);
  const customerObjId = new mongoose.Types.ObjectId(customerId);

  // ---------- 2. Date ranges ----------
  const now = new Date();

  // Today – from 00:00:00 of current day
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  // Last month – first day 00:00:00 → last day 23:59:59.999
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
    999
  );

  // ---------- 3. Parallel aggregations ----------
  const [todayAgg, lastMonthAgg, totalAgg] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          companyId: companyObjId,
          customerId: customerObjId,
          createdAt: { $gte: startOfToday },
        },
      },
      {
        $group: {
          _id: null,
          todaySales: { $sum: "$grandTotal" },
        },
      },
    ]),

    Order.aggregate([
      {
        $match: {
          companyId: companyObjId,
          customerId: customerObjId,
          createdAt: {
            $gte: startOfLastMonth,
            $lte: endOfLastMonth,
          },
        },
      },
      {
        $group: {
          _id: null,
          lastMonthSales: { $sum: "$grandTotal" },
        },
      },
    ]),

    Order.aggregate([
      {
        $match: {
          companyId: companyObjId,
          customerId: customerObjId,
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
        },
      },
    ]),
  ]);
  console.log("todayAgg:", todayAgg);
  console.log("lastMonthAgg:", lastMonthAgg);
  console.log("totalAgg:", totalAgg);

  // ---------- 4. Normalise results ----------
  const todaySales = todayAgg[0]?.todaySales ?? 0;
  const lastMonthSales = lastMonthAgg[0]?.lastMonthSales ?? 0;
  const totalSales = totalAgg[0]?.totalSales ?? 0;

  // ---------- 5. Send response ----------
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { todaySales, lastMonthSales, totalSales },
        "Customer sales stats fetched successfully"
      )
    );
});

// controllers/orderController.ts
exports.getSalesTrend = asyncHandler(async (req, res) => {
  const { companyId } = req.params;
  const clientId = req.user?.clientID;

  if (!companyId || !clientId) {
    throw new ApiError(400, "companyId and clientId are required");
  }

  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const pipeline = [
    {
      $match: {
        companyId: new mongoose.Types.ObjectId(companyId),
        clientId: new mongoose.Types.ObjectId(clientId),
        createdAt: { $gte: twelveMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        totalSales: { $sum: "$grandTotal" },
        totalOrders: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 },
    },
    {
      $project: {
        _id: 0,
        name: {
          $concat: [
            {
              $substr: [
                {
                  $arrayElemAt: [
                    [
                      "",
                      "Jan",
                      "Feb",
                      "Mar",
                      "Apr",
                      "May",
                      "Jun",
                      "Jul",
                      "Aug",
                      "Sep",
                      "Oct",
                      "Nov",
                      "Dec",
                    ],
                    "$_id.month",
                  ],
                },
                0,
                3,
              ],
            },
            " ",
            { $toString: "$_id.year" },
          ],
        },
        sales: { $divide: ["$totalSales", 100000] }, // Convert to Lakhs
        orders: "$totalOrders",
      },
    },
  ];

  const result = await Order.aggregate(pipeline);

  // Fill missing months with 0
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const filledData = [];
  let current = new Date(twelveMonthsAgo);

  for (let i = 0; i < 12; i++) {
    const monthKey = `${
      monthNames[current.getMonth()]
    } ${current.getFullYear()}`;
    const existing = result.find((r) => r.name === monthKey);
    filledData.push(existing || { name: monthKey, sales: 0, orders: 0 });
    current.setMonth(current.getMonth() + 1);
  }

  res.json({
    success: true,
    data: filledData,
  });
});
