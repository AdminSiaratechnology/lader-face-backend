const Order = require("../models/order.model");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const Company =require("../models/Company")
const Cart=require("../models/Cart")
const { Worker } = require("worker_threads");
const path = require("path");
// ✅ Create Order
exports.createOrder = asyncHandler(async (req, res) => {
  try {
    const { companyId, customerId, shippingAddress, items, orderSource } = req.body;
    const clientId = req.user?.clientID;
    const userId = req.user?.id;

    console.log("🧾 Creating order...");

    if (!companyId || !clientId || !customerId || !userId || !items?.length || !orderSource) {
      throw new ApiError(400, "Missing required fields");
    }

    for (const item of items) {
      if (!item.productId || !item.quantity || !item.price) {
        throw new ApiError(400, "Each item must include productId, quantity, and price");
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
    const totalDiscount = items.reduce((acc, item) => acc + (item.discount || 0), 0);
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

    // ✅ Populate limited customer fields
    const populatedOrder = await Order.findById(order._id)
      .populate({
        path: "customerId",
        select: "customerName emailAddress phone country currency",
      })
      .lean();

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
      .json(new ApiResponse(201, populatedOrder, `Order created successfully (${order.status})`));

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
  try {
    const { status } = req.body;
    const { id } = req.params;
    const clientId = req.user?.clientID;
    const userId = req.user?.id;

    // 🧩 Validate user
    if (!clientId || !userId) {
      throw new ApiError(401, "Unauthorized access — user credentials missing");
    }

    // 🧩 Validate input
    const validStatuses = ["approved", "cancelled", "completed", "pending"];
    if (!status || !validStatuses.includes(status)) {
      throw new ApiError(400, "Invalid or missing order status");
    }

    const order = await Order.findById(id);
    if (!order) throw new ApiError(404, "Order not found");

    // 🔒 Validation for allowed transitions
    if ( status === "pending") {
      throw new ApiError(400, "Cannot revert order to pending");
    }
    if (order.status === "completed" && status === "cancelled") {
      throw new ApiError(400, "Cannot cancel a completed order");
    }

    // ✅ Update status
    order.status = status;
    order.updatedBy = userId;
    await order.save();

    res.status(200).json(
      new ApiResponse(200, order, `Order status updated to '${status}' successfully`)
    );
  } catch (error) {
    console.error("❌ Error updating order status:", error);
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

exports.updateOrderDetails = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { shippingAddress, items = [], remarks, payment, updatedBy } = req.body;
    const clientId = req.user?.clientID;
    const userId = req.user?.id;

    // 🧩 Validate user
    if (!clientId || !userId) {
      throw new ApiError(401, "Unauthorized access — user credentials missing");
    }

    const order = await Order.findById(id);
    if (!order) throw new ApiError(404, "Order not found");

    // 🚫 Restrict modification for confirmed/approved/cancelled orders
    if (["confirmed", "approved", "cancelled"].includes(order.status)) {
      throw new ApiError(403, `${order.status} orders cannot be modified`);
    }

    // 🧩 Validate products — new addition not allowed
    if (items.length) {
      const existingProductIds = order.items.map((i) => i.productId.toString());
      const newProductIds = items.map((i) => i.productId.toString());

      // ❌ Detect any new product being added
      const extraProducts = newProductIds.filter(
        (pid) => !existingProductIds.includes(pid)
      );
      if (extraProducts.length > 0) {
        throw new ApiError(400, "New products cannot be added to an existing order");
      }

      // ✅ Identify removed items (not in new payload)
      const remainingProductIds = existingProductIds.filter((pid) =>
        newProductIds.includes(pid)
      );

      // ✅ Update existing items and filter removed ones
      order.items = order.items
        .filter((i) => remainingProductIds.includes(i.productId.toString())) // remove missing ones
        .map((existingItem) => {
          const updatedItem = items.find(
            (i) => i.productId.toString() === existingItem.productId.toString()
          );

          if (updatedItem) {
            const quantity = updatedItem.quantity ?? existingItem.quantity;
            const price = updatedItem.price ?? existingItem.price;
            const discount = updatedItem.discount ?? existingItem.discount ?? 0;

            if (quantity <= 0) return null; // if 0 qty, remove item

            const total = price * quantity - discount;
            return {
              ...existingItem.toObject(),
              quantity,
              price,
              discount,
              total,
            };
          }
          return existingItem;
        })
        .filter(Boolean); // remove null items (qty 0)
    }

    // ❌ Ensure at least one product remains
    if (!order.items || order.items.length === 0) {
      throw new ApiError(400, "Order must contain at least one product");
    }

    // 🏠 Update shipping address if provided
    if (shippingAddress) order.shippingAddress = shippingAddress;

    // 🧾 Update payment and remarks
    if (payment) order.payment = { ...order.payment, ...payment };
    if (remarks) order.remarks = remarks;

    order.updatedBy = updatedBy || userId;

    // 🧮 Recalculate totals
    const subtotal = order.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const totalDiscount = order.items.reduce((acc, i) => acc + (i.discount || 0), 0);
    order.discount = totalDiscount;
    order.grandTotal = subtotal - totalDiscount;

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

    const filter = {};
    if (companyId) filter.companyId = companyId;
    if (clientId) filter.clientId = clientId;
    if (status) filter.status = status;
    if (paymentStatus) filter["payment.status"] = paymentStatus;

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        // .populate("companyId clientId customerId userId", "name email")
        // .populate("items.productId", "name price remarks")
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
      return res
        .status(401)
        .json({
          success: false,
          message: "Unauthorized: Missing client or user info",
        });
    }

    // 🧾 Build Filter
    const filter = { companyId, clientId };
    if (status) filter.status = status;
    if (paymentStatus) filter["payment.status"] = paymentStatus;

    const skip = (page - 1) * limit;

    // 📦 Fetch Orders with Pagination
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
      return res
        .status(401)
        .json({
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
  console.log("getStateWiseSales");

  console.log("getStateWiseSales");
  try {
    const { companyId} = req.params;
    const clientId = req.user?.clientID;
    console.log("getStateWiseSales", companyId, clientId);

    const data = await Order.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId), clientId: new mongoose.Types.ObjectId(clientId) } },
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
          _id: "$userId",
          totalSales: { $sum: "$grandTotal" },
          totalOrders: { $sum: 1 },
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
              },
            },
          ],
          as: "salesman",
        },
      },
      { $unwind: "$salesman" },
      { $sort: { totalSales: -1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



exports.getTodaySales = async (req, res) => {

     const { companyId } = req.params;
    const clientId = req.user?.clientID;
  try {
  
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const data = await Order.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId), clientId: new mongoose.Types.ObjectId(clientId), createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    res.json({ success: true, data: data[0] || { totalSales: 0, totalOrders: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.getMonthlySalesComparison = async (req, res) => {
  try {
   const { companyId } = req.params;
    const clientId = req.user?.clientID;
    const now = new Date();

    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonth, prevMonth] = await Promise.all([
      Order.aggregate([
        { $match: { companyId: new mongoose.Types.ObjectId(companyId), clientId: new mongoose.Types.ObjectId(clientId), createdAt: { $gte: thisMonthStart, $lte: thisMonthEnd } } },
        { $group: { _id: null, totalSales: { $sum: "$grandTotal" }, totalOrders: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { companyId: new mongoose.Types.ObjectId(companyId), clientId: new mongoose.Types.ObjectId(clientId), createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
        { $group: { _id: null, totalSales: { $sum: "$grandTotal" }, totalOrders: { $sum: 1 } } },
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
    const { limit = 5 } = req.query;

    // Logging for debug
    console.log('Company ID:', companyId);
    console.log('Client ID:', clientId);
    console.log('User:', req.user);

    if (!companyId || !clientId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing companyId or clientId' 
      });
    }

    const topProducts = await Order.aggregate([
      // Step 1: Match orders for the specific company and client
      { 
        $match: { 
          companyId: new mongoose.Types.ObjectId(companyId), 
          clientId: new mongoose.Types.ObjectId(clientId) 
        } 
      },
      
      // Step 2: Unwind items array to process each item separately
      { $unwind: "$items" },
      
      // Step 3: Group by productId and calculate totals
      { 
        $group: { 
          _id: "$items.productId", 
          totalQuantity: { $sum: "$items.quantity" }, 
          totalSales: { $sum: "$items.total" },
          totalOrders: { $sum: 1 }
        } 
      },
      
      // Step 4: Sort by quantity
      { $sort: { totalQuantity: -1 } },
      
      // Step 5: Limit results
      { $limit: parseInt(limit) },
      
      // Step 6: Lookup product details - TRY DIFFERENT COLLECTION NAMES
      {
        $lookup: {
          from: "products", // Try: "products", "product", or check your actual collection name in MongoDB
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      
      // Step 7: Unwind product details
      { 
        $unwind: { 
          path: "$productDetails", 
          preserveNullAndEmptyArrays: true 
        } 
      },
      
      // Step 8: Project final structure
      {
        $project: {
          _id: 0,
          productId: "$_id",
          totalQuantity: 1,
          totalSales: 1,
          totalOrders: 1,
          product: "$productDetails"
        }
      }
    ]);

    console.log('Top Products:', topProducts);

    res.json({ 
      success: true, 
      data: topProducts,
      count: topProducts.length 
    });

  } catch (err) {
    console.error('Aggregation error:', err);
    res.status(500).json({ 
      success: false, 
      message: err.message 
    });
  }
};


exports.getTotalPayments = async (req, res) => {
  try {
    const { companyId, clientId } = req.query;

    const data = await Order.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId), clientId: new mongoose.Types.ObjectId(clientId), "payment.status": "completed" } },
      { $group: { _id: null, totalPayment: { $sum: "$payment.amountPaid" } } },
    ]);

    res.json({ success: true, data: data[0] || { totalPayment: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



