const { parentPort, workerData } = require("worker_threads");
const mongoose = require("mongoose");
const AuditLog = require("../models/Auditlog");

const MONGO_URI = process.env.MONGODB_URI;


async function connectDB() {
  if (mongoose.connection.readyState === 1) return;

  try {
    await mongoose.connect(MONGO_URI);
  } catch (err) {
    parentPort.postMessage({ success: false, error: err.message });
    process.exit(1);
  }
}

async function logAudit() {
  try {
    await connectDB();
    const cleanData = { ...workerData };

    if (cleanData.referenceId) {
      const ref = cleanData.referenceId;

      // CASE 1 → Already ObjectId
      if (ref && ref._bsontype === "ObjectID") {
        cleanData.referenceId = ref;
      }

      // CASE 2 → Has `_id`
      else if (typeof ref === "object" && ref._id) {
        cleanData.referenceId = new mongoose.Types.ObjectId(ref._id);
      }

      // CASE 3 → Raw Buffer (your current case)
      else if (typeof ref === "object" && ref.buffer) {
        cleanData.referenceId = new mongoose.Types.ObjectId(ref.buffer);
      }

      // CASE 4 → Already valid string
      else if (typeof ref === "string") {
        cleanData.referenceId = new mongoose.Types.ObjectId(ref);
      }

      else {
        throw new Error(
          `Invalid referenceId format: ${JSON.stringify(ref)}`
        );
      }
    }

    await AuditLog.create({
      ...cleanData,
      timestamp: new Date(),
    });

    parentPort.postMessage({ success: true });

  } catch (err) {
    parentPort.postMessage({ success: false, error: err.message });
  }
  finally{
    await mongoose.disconnect()
  }
}


logAudit();