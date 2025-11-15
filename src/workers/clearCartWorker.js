const { parentPort } = require("worker_threads");
const mongoose = require("mongoose");
const Cart = require("../models/Cart");
(
  // adjust path as per your structure_
  async () => {
    try {
      const { clientId, companyId, userId, mongoUri } =
        require("worker_threads").workerData;

      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      await Cart.deleteMany({ clientId, companyId, userId });
      console.log(`🧹 Cart cleared for user ${userId}`);

      await mongoose.connection.close();
      parentPort.postMessage({ success: true });
    } catch (err) {
      console.error("❌ Worker failed:", err);
      parentPort.postMessage({ success: false, error: err.message });
    }
  }
)();
