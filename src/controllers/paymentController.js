const Payment = require("../models/payment");
const Order = require("../models/order.model");

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

    const payments = await Payment.find({ companyId, userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  } 
};