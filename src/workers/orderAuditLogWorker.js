const { parentPort, workerData } = require("worker_threads");
const mongoose = require("mongoose");
const OrderAuditLog = require("../models/orderAuditLog.model");

const MONGO_URI = process.env.MONGODB_URI;
console.log("🔧 Worker started for order audit logging", MONGO_URI);

async function connectDB() {
  if (!MONGO_URI) {
    console.error(
      "❌ WORKER ERROR: MONGO_URI is missing in the worker environment."
    );
    process.exit(1);
  }

  if (mongoose.connection.readyState === 1) return;

  try {
    await mongoose.connect(MONGO_URI);
    console.log("🚀 Worker connected to MongoDB");
  } catch (err) {
    console.error("❌ Worker MongoDB connection failed:", err);
    process.exit(1);
  }
}

async function logAudit() {
  try {
    await connectDB();

    await OrderAuditLog.create({
      ...workerData,
      timestamp: new Date(),
    });

    parentPort.postMessage({ success: true });
  } catch (err) {
    console.error("❌ Worker audit log failed:", err);
    parentPort.postMessage({ success: false, error: err.message });
  }
}

logAudit();
