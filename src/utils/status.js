const mongoose = require("mongoose");
const ApiError = require("../utils/apiError");

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

// ✅ Map of all models
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

// ✅ MongoDB connection string


async function updateAllStatuses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Loop through all models
    for (const [modelName, Model] of Object.entries(modelMap)) {
      const result = await Model.updateMany(
        {}, // all documents
        { $set: { status: "active" } }
      );

      console.log(`✅ ${modelName}: Updated ${result.modifiedCount} documents`);
    }

    console.log("🎉 All statuses updated to 'active'!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating statuses:", error);
    process.exit(1);
  }
}

updateAllStatuses();
