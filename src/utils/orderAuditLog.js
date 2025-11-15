const { Worker } = require("worker_threads");
const path = require("path");

exports.logAudit = (
  orderId,
  action,
  userId,
  clientId,
  companyId,
  oldData = null,
  newData = null,
  changes = null
) => {
  // ✅ Convert ObjectIds to strings before passing to worker_
  const orderIdStr = orderId.toString();
  const userIdStr = userId ? userId.toString() : null;
  const clientIdStr = clientId ? clientId.toString() : null;
  const companyIdStr = companyId ? companyId.toString() : null;
  // ✅ Stringify complex objects to avoid serialization issues_
  const oldDataStr = oldData ? JSON.stringify(oldData) : null;
  const newDataStr = newData ? JSON.stringify(newData) : null;
  const changesStr = changes ? JSON.stringify(changes) : null;

  console.log(
    "Starting audit log worker for",
    orderIdStr,
    action,
    userIdStr,
    clientIdStr,
    companyIdStr
  );

  const workerPath = path.join(__dirname, "../workers/orderAuditLogWorker.js");

  const worker = new Worker(workerPath, {
    workerData: {
      orderId: orderIdStr,
      action,
      userId: userIdStr,
      clientId: clientIdStr,
      companyId: companyIdStr,
      oldData: oldDataStr,
      newData: newDataStr,
      changes: changesStr,
    },

    env: {
      ...process.env,
      MONGO_URI: process.env.MONGO_URI,
    },
  });

  worker.on("message", (msg) => {
    if (msg.success) {
      console.log(
        `✅ Audit logged (worker): ${action} for order ${orderIdStr}`
      );
    } else {
      console.error(`❌ Worker audit failed: ${msg.error}`);
    }
  });

  worker.on("error", (err) => {
    console.error("💥 Worker thread error (audit):", err);
  });

  worker.on("exit", (code) => {
    if (code !== 0) {
      console.error(`⚠️ Worker exited with code ${code} (audit)`);
    }
  });
};
