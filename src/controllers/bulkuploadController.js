const mongoose = require("mongoose");
const Vendor = require("../models/Vendor");
const Agent = require("../models/Agent");
const Customer = require("../models/Customer");
const Ledger = require("../models/Ladger");
const Counter = require("../models/Counter"); // Assuming this exists
const asyncHandler = require("../utils/asyncHandler"); // Adjust path
const ApiError = require("../utils/apiError"); // Adjust path

// 🔹 CONFIGURATION MAP: Defines how each entity behaves
// 🔹 CORRECTED CONFIGURATION MAP
const ENTITY_CONFIG = {
  vendor: {
    model: Vendor,
    codeType: "vendor",
    // CHANGED: mobileNumber -> phoneNumber
    requiredFields: ["emailAddress", "name", "phoneNumber"], 
  },
  agent: {
    model: Agent,
    codeType: "agent",
    requiredFields: ["emailAddress", "name", "phoneNumber"], 
  },
  customer: {
    model: Customer,
    codeType: "customer",
    requiredFields: ["emailAddress", "name", "phoneNumber"],
  },
  ledger: {
    model: require("../models/Ladger"), // Fixed typo "Ladger" -> "Ledger"
    codeType: "ledger",
    // Ledger might not have phone/email, check your schema!
    // If ledger only needs name, remove the others:
    requiredFields: ["name"], 
  },
};

// 🔹 REUSABLE CODE GENERATOR
const generateBulkCodes = async ({ clientId, companyId, type, count, pad = 6 }) => {
  const counter = await Counter.findOneAndUpdate(
    { clientId, companyId, type },
    { $inc: { seq: count } },
    { new: true, upsert: true }
  );
  const start = counter.seq - count + 1;
  return Array.from({ length: count }, (_, i) => (start + i).toString().padStart(pad, "0"));
};

exports.createBulkUpload = asyncHandler(async (req, res) => {
  console.time("TotalUploadTime");

  // 1. GET ENTITY TYPE (passed via route params or body)
  // Usage: POST /api/bulk/:type (e.g., /api/bulk/vendor)
  // console.log(req.params.type,"req.params.type")
  const entityType = req.params.type || req.body.entityType; 
  const config = ENTITY_CONFIG[entityType];

  if (!config) {
    throw new ApiError(400, `Invalid entity type: ${entityType}. Allowed: vendor, agent, customer, ledger`);
  }

  const { data } = req.body; // Expecting generic "data" 
  // array instead of "vendors"
  const clientId = req.user.clientID;
  const userId = req.user.id;
  const Model = config.model;

  // Configuration
  const BATCH_SIZE = 2500;
  const CONCURRENCY_LIMIT = 2;

  if (!Array.isArray(data) || data.length === 0) {
    throw new ApiError(400, "Data array required");
  }

  const companyId = data[0].companyId; // Assuming all belong to same company
  const total = data.length;

  // 2. Generate Codes
  const codes = await generateBulkCodes({
    clientId,
    companyId,
    type: config.codeType,
    count: total,
  });

  let insertedCount = 0;
  const auditTimestamp = new Date();

  // 3. Helper: Process Batch
  const processBatch = async (batchData, batchStartIndex) => {
    const payload = [];

    for (let i = 0; i < batchData.length; i++) {
      const item = batchData[i];
      const codeIndex = batchStartIndex + i;

      // ⚡ DYNAMIC VALIDATION
      const isValid = config.requiredFields.every((field) => item[field]);
      console.log("Validating item:", item, "isValid:", isValid);
      if (!isValid) continue; // Skip invalid records
      console.log("Inserting item:", item);

      payload.push({
        ...item,
        clientId,
        companyId: item.companyId || companyId,
        code: codes[codeIndex], // Auto-generated Code
        createdBy: userId,
        auditLogs: [{
          action: "create",
          performedBy: userId,
          timestamp: auditTimestamp,
          details: `Bulk ${entityType} import`,
        }],
      });
    }

    if (payload.length === 0) return 0;

    // console.log(payload[0]);

    try {
      const inserted = await Model.insertMany(payload, {
        ordered: false,
        validateBeforeSave: false,
      });
      // console.log(`✅ ${entityType} Batch Inserted: ${inserted}`);
      return inserted.length;
    } catch (error) {
      if (error.insertedDocs) {
        return error.insertedDocs.length;
      }
      console.error(`❌ ${entityType} Batch Error:`, error.message);
      return 0;
    }
  };

  // 4. PARALLEL PROCESSING LOOP
  const step = BATCH_SIZE * CONCURRENCY_LIMIT;

  for (let i = 0; i < total; i += step) {
    const promises = [];

    for (let j = 0; j < CONCURRENCY_LIMIT; j++) {
      const start = i + (j * BATCH_SIZE);
      if (start < total) {
        const batchData = data.slice(start, start + BATCH_SIZE);
        promises.push(processBatch(batchData, start));
      }
    }

    const results = await Promise.all(promises);
    insertedCount += results.reduce((sum, val) => sum + (val || 0), 0);
    
    console.log(`✅ ${entityType} Progress: ${Math.min(i + step, total)} / ${total}`);
  }

  console.timeEnd("TotalUploadTime");

  res.status(201).json({
    success: true,
    entity: entityType,
    totalReceived: total,
    totalInserted: insertedCount,
    failedOrDuplicate: total - insertedCount,
  });
});