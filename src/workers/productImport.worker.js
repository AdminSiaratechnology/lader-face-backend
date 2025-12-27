const { parentPort, workerData } = require("worker_threads");
const mongoose = require("mongoose");
const csv = require("csvtojson");

const Product = require("../models/Product");
const StockGroup = require("../models/StockGroup");
const StockCategory = require("../models/StockCategory");
const Unit = require("../models/Unit");

const { findOrCreateByName } = require("../utils/findOrCreateByName");
const { parseMonthYear } = require("../utils/parseMonthYear");

const MONGO_URI = process.env.MONGODB_URI;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    console.log("Already connected to MongoDB");
    return;
  }
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected successfully");
}

(async () => {
  try {
    const { csvString, user, clientId } = workerData;

    console.log("Worker started");
    console.log("CSV string length:", csvString?.length);
    console.log("User ID:", user?.id);
    console.log("Client ID:", clientId);

    await connectDB();

    // ✅ Parse CSV from string
    const csvData = await csv().fromString(csvString);
    console.log(`Total rows in CSV: ${csvData.length}`);

    if (csvData.length === 0) {
      parentPort.postMessage({
        error: "CSV file is empty or invalid",
      });
      return;
    }

    let inserted = 0;
    let skipped = 0;
    const errors = [];
    const productsToInsert = [];

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];

      try {
        // Validate companyId
        const companyId = row.companyId?.trim();
        if (!companyId) {
          throw new Error("companyId missing");
        }

        // Validate product name
        const productName = row.Name?.trim();
        if (!productName) {
          throw new Error("Product name missing");
        }

        // Check if product already exists
        const exists = await Product.exists({
          name: new RegExp("^" + productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "$", "i"),
          companyId,
          clientId,
        });

        if (exists) {
          skipped++;
          continue;
        }

        // Find or create related entities
        const [stockGroup, stockCategory, unit] = await Promise.all([
          row["Stock Group"]?.trim() 
            ? findOrCreateByName(StockGroup, row["Stock Group"], companyId, user.id, clientId)
            : Promise.resolve(null),
          row["Stock Category"]?.trim()
            ? findOrCreateByName(StockCategory, row["Stock Category"], companyId, user.id, clientId)
            : Promise.resolve(null),
          row["Unit"]?.trim()
            ? findOrCreateByName(Unit, row["Unit"], companyId, user.id, clientId)
            : Promise.resolve(null),
        ]);

        // Prepare product data
        productsToInsert.push({
          clientId,
          companyId,
          name: productName,
          partNo: row["Part No"]?.trim() || null,
          stockGroup: stockGroup?._id || null,
          stockCategory: stockCategory?._id || null,
          unit: unit?._id || null,
          minimumQuantity: Number(row["Minimum Quantity"]) || 0,
          minimumRate: Number(row["Minimum Rate"]) || 0,
          maximumRate: Number(row["Maximum Rate"]) || 0,
          batch: ["yes", "true", "1"].includes(
            (row["Batch Managed"] || "").toLowerCase().trim()
          ),
          mfgDate: parseMonthYear(row["Mfg Date (YYYY-MM)"]),
          expiryDate: parseMonthYear(row["Expiry Date (YYYY-MM)"]),
          status: "active",
          createdBy: user.id,
        });

        console.log(`Processed row ${i + 1}/${csvData.length}`);
      } catch (err) {
        console.error(`Error on row ${i + 2}:`, err.message);
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }

    // Bulk insert products
    if (productsToInsert.length > 0) {
      console.log(`Inserting ${productsToInsert.length} products...`);
      const result = await Product.insertMany(productsToInsert, { ordered: false });
      inserted = result.length;
      console.log(`Successfully inserted ${inserted} products`);
    }

    // Send result back to main thread
    parentPort.postMessage({
      total: csvData.length,
      inserted,
      skipped,
      failed: errors.length,
      errors: errors.slice(0, 100), // Limit errors to first 100
    });

    // Close DB connection
    await mongoose.connection.close();
    console.log("Worker completed successfully");

  } catch (err) {
    console.error("Worker fatal error:", err);
    parentPort.postMessage({ 
      error: err.message,
      stack: err.stack,
    });
    
    // Try to close DB connection
    try {
      await mongoose.connection.close();
    } catch (closeErr) {
      console.error("Error closing DB:", closeErr);
    }
  }
})();