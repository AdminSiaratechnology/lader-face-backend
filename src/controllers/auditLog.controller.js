const AuditLog = require("../models/Auditlog");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");
const ApiError = require("../utils/apiError");
const mongoose = require("mongoose");

const Company = require("../models/Company");
const Customer = require("../models/Customer");
const Agent = require("../models/Agent");
const Unit = require("../models/Unit");
const Godown = require("../models/Godown");
const StockCategory = require("../models/StockCategory");
const StockGroup = require("../models/StockGroup");
const User = require("../models/User");
const Vendor = require("../models/Vendor");
const Ledger = require("../models/Ladger");
const Product = require("../models/Product");
const { createAuditLog } = require("../utils/createAuditLog");
const Auditlog = require("../models/Auditlog");
const modelMap = {
  Company,
  Customer,
  Agent,
  Unit,
  Godown,
  StockCategory,
  StockGroup,
  Vendor,
  Product,
  User,
  Ledger,
};

// ✅ Get all Audit Logs by Client ID
exports.getAuditLogsByClient = asyncHandler(async (req, res) => {
  const clientID = req.user.clientID;
  if (!clientID) throw new ApiError(400, "Client ID is required");
  console.log("hiiii");
  // Query params for filtering/sorting/pagination
  const {
    search = "",
    module = "",
    action = "",
    performedBy = "",
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 10,
  } = req.query;

  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;

  // ✅ Filters
  const filter = { clientId: clientID };

  if (module && module.trim() !== "") filter.module = module;
  if (action && action.trim() !== "") filter.action = action;

  // performedBy user id or name search
  if (performedBy && mongoose.Types.ObjectId.isValid(performedBy)) {
    filter.performedBy = new mongoose.Types.ObjectId(performedBy);
  }

  // ✅ Search in module, details or IP
  if (search && search.trim() !== "") {
    filter.$or = [
      { module: { $regex: search, $options: "i" } },
      { details: { $regex: search, $options: "i" } },
      { ipAddress: { $regex: search, $options: "i" } },
    ];
  }

  // ✅ Sorting
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };

  // ✅ Fetch logs & count
  const [auditLogs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("performedBy", "name email role")
      .sort(sortOptions)
      .skip(skip)
      .limit(perPage),
    AuditLog.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        auditLogs,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      auditLogs.length
        ? "Audit logs fetched successfully"
        : "No audit logs found"
    )
  );
});

exports.getAuditLogsByClientAllAudilog = asyncHandler(async (req, res) => {
  const clientID = req.user.clientID;
  if (!clientID) throw new ApiError(400, "Client ID is required");
  // Query params for filtering/sorting/pagination
  const {
    search = "",
    module = "",
    action = "",
    performedBy = "",
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    limit = 10,
  } = req.query;

  const perPage = parseInt(limit, 10);
  const currentPage = Math.max(parseInt(page, 10), 1);
  const skip = (currentPage - 1) * perPage;

  // ✅ Filters
  const filter = { clientId: clientID };

  if (module && module.trim() !== "") filter.module = module;
  if (action && action.trim() !== "") filter.action = action;

  // performedBy user id or name search
  if (performedBy && mongoose.Types.ObjectId.isValid(performedBy)) {
    filter.performedBy = new mongoose.Types.ObjectId(performedBy);
  }

  // ✅ Search in module, details or IP
  if (search && search.trim() !== "") {
    filter.$or = [
      { module: { $regex: search, $options: "i" } },
      { details: { $regex: search, $options: "i" } },
      { ipAddress: { $regex: search, $options: "i" } },
    ];
  }

  // ✅ Sorting
  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOptions = { [sortBy]: sortDirection };

  // ✅ Fetch logs & count
  const [auditLogs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("performedBy", "name email role")
      .populate("referenceId")
      .sort(sortOptions)
      .skip(skip)
      .limit(perPage),
    AuditLog.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        auditLogs,
        pagination: {
          total,
          page: currentPage,
          limit: perPage,
          totalPages: Math.ceil(total / perPage),
        },
      },
      auditLogs.length
        ? "Audit logs fetched successfully"
        : "No audit logs found"
    )
  );
});

exports.getAuditLogsByClientDetailByID = asyncHandler(async (req, res) => {
  const clientID = req.user.clientID;
  if (!clientID) throw new ApiError(400, "Client ID is required");

  const { id } = req.params;
  console.log("getAuditLogsByClientDetailByID");
  // Query params for filtering/sorting/pagination

  // ✅ Filters
  const filter = { clientId: clientID, _id: new mongoose.Types.ObjectId(id) };

  // ✅ Fetch logs & count
  const [auditLogs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("performedBy", "name email role")
      .populate("referenceId"),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        auditLogs,
      },
      auditLogs.length
        ? "Audit logs fetched successfully"
        : "No audit logs found"
    )
  );
});

exports.restoreRecord = async (req, res) => {
  console.log("restoreRecord");
  try {
    const { module, referenceId, id } = req.body; // module = model name, id = audit log id
    const performedBy = req.user.id;
    const clientId = req.user.clientID;

    if (!module || !referenceId) {
      return res.status(400).json({
        success: false,
        message: "Module name and referenceId are required",
      });
    }

    const Model = modelMap[module];
    if (!Model)
      return res.status(400).json({
        success: false,
        message: "Invalid module name",
      });
    console.log(Model, "model");
    const record = await Model.findById(referenceId);
    console.log(module, "module");
    console.log(record, "record");

    if (!record)
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });

    if (record.status === "active") {
      return res.status(400).json({
        success: false,
        message: "Record already active",
      });
    }

    // ✅ Restore logic
    record.status = "active";
    await record.save();

    // ✅ Get IP Address properly
    let ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "Unknown";

    if (ipAddress.startsWith("::ffff:")) ipAddress = ipAddress.slice(7);
    if (ipAddress === "::1") ipAddress = "127.0.0.1";

    // ✅ Update the existing Audit Log entry
    const updatedAudit = await AuditLog.findByIdAndUpdate(
      id,
      {
        action: "update",
        ipAddress,
        details: `${module} record restored`,
        changes: { status: "active" },
        performedBy,
        clientId,
      },
      { new: true }
    );

    if (!updatedAudit) {
      return res.status(404).json({
        success: false,
        message: "Audit log entry not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `${module} record restored successfully`,
      updatedAudit,
    });
  } catch (error) {
    console.error("Restore Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getAllAuditLogs = async (req, res) => {
  try {
    const { search = "", role, action, startDate, endDate, page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const match = {};

    // Filter by action (create, update, delete, login)
    if (action) {
      match["auditLogs.action"] = action;
    }

    // Date filters
    if (startDate && endDate) {
      match["auditLogs.timestamp"] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Flatten logs using aggregation
    const logs = await User.aggregate([
      { $unwind: "$auditLogs" },

      // Global filtering
      { $match: match },

      // If searching by user name/email
      {
        $lookup: {
          from: "users",
          localField: "auditLogs.performedBy",
          foreignField: "_id",
          as: "performedByUser"
        }
      },
      { $unwind: "$performedByUser" },

      // Filter by role (Partner, Client, etc.)
      role ? { $match: { "performedByUser.role": role } } : { $match: {} },

      // Search by name / email
      search
        ? {
            $match: {
              $or: [
                { "performedByUser.name": { $regex: search, $options: "i" } },
                { "performedByUser.email": { $regex: search, $options: "i" } }
              ]
            }
          }
        : { $match: {} },

      // Final projection
      {
        $project: {
          _id: 0,
          moduleUserId: "$_id", // the user on whom action occurred
          action: "$auditLogs.action",
          timestamp: "$auditLogs.timestamp",
          details: "$auditLogs.details",
          changes: "$auditLogs.changes",
          performedBy: {
            _id: "$performedByUser._id",
            name: "$performedByUser.name",
            email: "$performedByUser.email",
            role: "$performedByUser.role",
            subRole: "$performedByUser.subRole"
          }
        }
      },

      { $sort: { timestamp: -1 } },

      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    res.json({ success: true, logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};
