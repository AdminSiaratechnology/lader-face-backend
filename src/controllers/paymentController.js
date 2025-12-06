const Payment = require("../models/payment");
const Order = require("../models/order.model");
const Customer = require("../models/Customer");
const User = require("../models/User");
const mongoose = require("mongoose");

exports.createPayment = async (req, res, next) => {
  try {
    const {
      mode,
      amount,
      transactionId,
      status,
      orderId,
      companyId,
      customerId,
      remarks,
    } = req.body;
    const userId = req.user?.id;
    const clientId = req.user.clientID;

    // Extract uploaded files (AWS S3 / Multer-S3)
    const uploadedDocs = req.files?.documents || [];
    const uploadedUrls = uploadedDocs.map((file) => file.location);

    // Final documents array (uploaded OR body OR fallback)
    const finalDocuments =
      uploadedUrls.length > 0
        ? uploadedUrls
        : Array.isArray(req.body.documents)
        ? req.body.documents
        : [];

    const payment = await Payment.create({
      orderId,
      companyId,
      clientId,
      customerId,
      userId,
      mode,
      amount,
      transactionId: transactionId || null,
      status: status || "initiated",
      documents: finalDocuments,
      remarks: remarks || "",
    });

    // await updateOrderPaymentSummary(orderId);

    res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// Get all payments for an order
exports.getPaymentsByOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const payments = await Payment.find({ orderId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

// Get single payment
exports.getPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);

    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// Update payment
exports.updatePayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?.id;

    let payment = await Payment.findById(paymentId);
    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });

    // ✅ FIX: Safe check for uploaded documents
    const uploadedDocs =
      req.files && req.files.documents ? req.files.documents : [];

    const uploadedUrls = uploadedDocs.map((file) => file.location);

    // ✅ Final documents logic (safe)
    const finalDocuments =
      uploadedUrls.length > 0
        ? uploadedUrls
        : Array.isArray(req.body?.documents)
        ? req.body.documents
        : payment.documents;

    const updateData = {
      mode: req.body.mode ?? payment.mode,
      amount: req.body.amount ?? payment.amount,
      status: req.body.status ?? payment.status,
      transactionId: req.body.transactionId ?? payment.transactionId,
      documents: finalDocuments,
      userId: userId ?? payment.userId,
      remarks: req.body.remarks ?? payment.remarks,
    };

    payment = await Payment.findByIdAndUpdate(paymentId, updateData, {
      new: true,
      runValidators: true,
    });

    // await updateOrderPaymentSummary(payment.orderId);

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// Delete payment
exports.deletePayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId);
    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });

    payment.status = "delete";
    await payment.save();

    res.status(200).json({
      success: true,
      message: "Payment status changed to deleted",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

exports.getPaymnetsForCustomer = async (req, res, next) => {
  try {
    const clientId = req.user.clientID;
    const customerId = req.params.customerId;
    const payments = await Payment.find({ clientId, customerId }).sort({
      createdAt: -1,
    });
    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};
// Utility: Update Order Payment Summary
// async function updateOrderPaymentSummary(orderId) {
//   const completedPayments = await Payment.aggregate([
//     { $match: { orderId: orderId, status: "completed" } },
//     { $group: { _id: null, total: { $sum: "$amount" } } },
//   ]);

//   const totalPaid = completedPayments?.[0]?.total || 0;

//   await Order.findByIdAndUpdate(orderId, {
//     paymentSummary: {
//       totalPaid,
//       lastUpdate: new Date(),
//     },
//   });
// }

exports.getAllPaymentsByCompanyId = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const userId = req.user?.id;

    const payments = await Payment.find({ companyId, userId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
};

exports.getPaymentReport = async (req, res) => {
  try {
    const {
      companyId,
      page = 1,
      limit = 10,
      search,
      status,
      mode,
      userId,
      startDate,
      endDate,
    } = req.query;

    // Validate companyId
    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({
        success: false,
        message: "Valid companyId is required",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = { companyId: new mongoose.Types.ObjectId(companyId) }; // Fixed: use 'new'

    // Text search
    if (search) {
      query.$or = [
        { remarks: { $regex: search, $options: "i" } },
        { transactionId: { $regex: search, $options: "i" } },
      ];
    }

    // Filters
    if (status && status !== "all") query.status = status;
    if (mode && mode !== "all") query.mode = mode;
    if (userId && userId !== "all") {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid userId" });
      }
      query.userId = new mongoose.Types.ObjectId(userId);
    }

    // Date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Aggregation pipeline
    const pipeline = [
      { $match: query },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          customerName: {
            $ifNull: ["$customer.customerName", "Unknown Customer"],
          },
          userName: { $ifNull: ["$user.name", "System"] },
        },
      },
      {
        $project: {
          _id: 1,
          amount: 1,
          mode: 1,
          status: 1,
          remarks: 1,
          transactionId: 1,
          documents: 1,
          createdAt: 1,
          customerName: 1,
          userName: 1,
        },
      },
    ];

    // Total count
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Payment.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / parseInt(limit));

    // Paginated data
    const dataPipeline = [
      ...pipeline,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ];

    const payments = await Payment.aggregate(dataPipeline);

    // Stats
    const statsPipeline = [
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalPayments: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          initiated: {
            $sum: { $cond: [{ $eq: ["$status", "initiated"] }, 1, 0] },
          },
        },
      },
    ];

    const statsResult = await Payment.aggregate(statsPipeline);
    const stats = statsResult[0] || {
      totalAmount: 0,
      totalPayments: 0,
      pending: 0,
      completed: 0,
      failed: 0,
      initiated: 0,
    };

    res.json({
      success: true,
      data: {
        payments,
        stats,
        pagination: {
          total,
          totalPages,
          currentPage: parseInt(page),
          limit: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Payment Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
/**
 * Assumes 'Order' and 'Payment' Mongoose models are imported and available.
 */
exports.getCustomerWiseReport = async (req, res) => {
  try {
    const {
      companyId,
      page = 1,
      limit = 1200,
      search,
      salesmanId,
      status,
      mode,
      startDate,
      endDate,
    } = req.query;

    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid companyId required" });
    }

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);
    const skip = (parsedPage - 1) * parsedLimit;
    const companyObjId = new mongoose.Types.ObjectId(companyId);

    // 1. Build Base Match and Search Criteria
    const baseMatch = { companyId: companyObjId };
    
    // Date filter
    if (startDate || endDate) {
      baseMatch.createdAt = {};
      if (startDate) baseMatch.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        baseMatch.createdAt.$lte = end;
      }
    }

    const searchRegex = search ? { $regex: search, $options: "i" } : null;

    // 2. Define ORDERS PIPELINE (Run on Order Model)
    const ordersPipeline = [
      { $match: { ...baseMatch, status: "approved" } },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "salesman",
        },
      },
      { $unwind: { path: "$salesman", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $and: [
            salesmanId && salesmanId !== "all"
              ? { "salesman._id": new mongoose.Types.ObjectId(salesmanId) }
              : {},
            searchRegex
              ? {
                  $or: [
                    { orderCode: searchRegex },
                    { "customer.customerName": searchRegex },
                    { "salesman.name": searchRegex },
                  ],
                }
              : {},
          ].filter(Boolean),
        },
      },
      {
        $project: {
          type: "Order",
          date: "$createdAt",
          customerName: { $ifNull: ["$customer.customerName", "Unknown"] },
          salesmanName: { $ifNull: ["$salesman.name", "System"] },
          orderAmount: "$grandTotal",
          paymentAmount: null,
          status: "$status",
          remarks: "$orderCode",
          sortDate: "$createdAt",
        },
      },
    ];

    // 3. Define PAYMENTS PIPELINE (Run on Payment Model)
    const paymentsPipeline = [
      { $match: { ...baseMatch } },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $and: [
            status && status !== "all" ? { status } : {},
            mode && mode !== "all" ? { mode } : {},
            salesmanId && salesmanId !== "all"
              ? { "user._id": new mongoose.Types.ObjectId(salesmanId) }
              : {},
            searchRegex
              ? {
                  $or: [
                    { remarks: searchRegex },
                    { transactionId: searchRegex },
                    { "customer.customerName": searchRegex },
                    { "user.name": searchRegex },
                  ],
                }
              : {},
          ].filter(Boolean),
        },
      },
      {
        $project: {
          type: "Payment",
          date: "$createdAt",
          customerName: { $ifNull: ["$customer.customerName", "Unknown"] },
          salesmanName: { $ifNull: ["$user.name", "System"] },
          orderAmount: null,
          paymentAmount: "$amount", // Confirmed field: "amount"
          status: "$status",
          remarks: { $ifNull: ["$remarks", "Payment Received"] },
          sortDate: "$createdAt",
        },
      },
    ];

    // 4. Execute both pipelines separately
    const ordersData = await Order.aggregate(ordersPipeline);
    
    // NOTE: Replace 'Payment' with your actual Payment Mongoose model name if different
    const paymentsData = await Payment.aggregate(paymentsPipeline); 
    
    // 5. Combine, Sort, and Paginate in Node.js (or Mongoose if data is huge)
    // If the combined result is massive (millions of records), consider merging the collections
    // inside MongoDB first. For typical reports, this JavaScript method is sufficient.
    
    const combinedData = [...ordersData, ...paymentsData];

    // Total count before pagination
    const total = combinedData.length;
    const totalPages = Math.ceil(total / parsedLimit);
    
    // Sort combined data by 'sortDate' descending
    combinedData.sort((a, b) => b.sortDate - a.sortDate);

    // Apply pagination
    const paginatedData = combinedData.slice(skip, skip + parsedLimit);

    // 6. Calculate Stats on the PAGINATED data
    const stats = {
      totalTransactions: paginatedData.length,
      totalSales: paginatedData.reduce((sum, d) => sum + (d.orderAmount || 0), 0),
      totalReceived: paginatedData.reduce((sum, d) => sum + (d.paymentAmount || 0), 0),
      outstanding: paginatedData.reduce(
        (sum, d) => sum + ((d.orderAmount || 0) - (d.paymentAmount || 0)),
        0
      ),
    };

    // 7. Send Response
    res.json({
      success: true,
      data: paginatedData,
      stats,
      pagination: {
        total,
        totalPages,
        currentPage: parsedPage,
        limit: parsedLimit,
      },
    });
  } catch (error) {
    console.error("Customer Wise Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch report",
      error: error.message,
    });
  }
};