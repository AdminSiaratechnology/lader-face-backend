const path = require("path");
const { Worker } = require("worker_threads");

module.exports = function createAuditLog(data) {
return new Promise((resolve, reject) => {
console.log(data,"data")
const worker = new Worker(
path.join(__dirname, "../workers/AuditLogWorker.js"),
{ workerData: data }
);

worker.on("message", (msg) => {
if (msg.success) resolve(true);
else reject(msg.error);
});

worker.on("error", reject);
worker.on("exit", (code) => {
if (code !== 0) reject(`Worker stopped with code: ${code}`);
});
});
};