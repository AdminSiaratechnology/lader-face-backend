
const csv = require("csvtojson");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path")
const PriceListPage =  require("../models/PriceListPage");
const PriceLevel = require("../models/PriceLevel");

const Product = require("../models/Product");
const { Parser } = require("json2csv");

const generateSixDigitCode = async (companyId) => {
  let code;
  let exists = true;

  while (exists) {
    code = Math.floor(100000 + Math.random() * 900000).toString();

    exists = await PriceListPage.exists({
      companyId,
      code,
    });
  }

  return code;
};
const savePriceListPage = async (req, res) => {
  const clientId = req.user.clientID;

  try {
    const {
      companyId,
      priceLevel,
      stockGroupId,
      stockGroupName,
      applicableFrom,
      page,
      items,
      code, // 👈 OPTIONAL FROM FRONTEND
    } = req.body;

    if (
      !companyId ||
      !clientId ||
      !priceLevel ||
      !applicableFrom ||
      page === undefined ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    /* 🔥 CLEAN ITEMS */
    const cleanedItems = items
      .map((item) => {
        const slabs = item.slabs
          .filter((s) => s.rate > 0 || s.discount > 0)
          .map((s) => ({
            fromQty: Number(s.fromQty),
            lessThanQty:
              s.lessThanQty === "" || s.lessThanQty === null
                ? null
                : Number(s.lessThanQty),
            rate: Number(s.rate) || 0,
            discount: Number(s.discount) || 0,
          }));

        return { ...item, slabs };
      })
      .filter((i) => i.slabs.length > 0);

    if (cleanedItems.length === 0) {
      return res.status(400).json({ message: "No valid slabs to save" });
    }

    /* 🔥 FIND EXISTING PAGE */
    const query = {
      companyId,
      clientId,
      priceLevel,
      applicableFrom,
      page,
    };

    if (stockGroupId && mongoose.Types.ObjectId.isValid(stockGroupId)) {
      query.stockGroupId = stockGroupId;
    }

    let existing = await PriceListPage.findOne(query);

    /* 🔥 CODE LOGIC */
    let finalCode = existing?.code;

    if (!finalCode) {
      finalCode = code || (await generateSixDigitCode(companyId));
    }

    /* 🔥 UPDATE DATA */
    const update = {
      companyId,
      clientId,
      code: finalCode,
      priceLevel,
      applicableFrom,
      page,
      items: cleanedItems,
    };

    if (stockGroupId && mongoose.Types.ObjectId.isValid(stockGroupId)) {
      update.stockGroupId = stockGroupId;
      update.stockGroupName = stockGroupName;
    } else {
      update.stockGroupName = "All";
    }

    const saved = await PriceListPage.findOneAndUpdate(query, update, {
      upsert: true,
      new: true,
    });

    return res.status(200).json({
      message: `Page ${page} saved successfully`,
      code: saved.code,
      itemCount: cleanedItems.length,
    });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
};


const getAllPriceList = async (req, res) => {
  try {
    const clientId = req.user.clientID;
    const { companyId } = req.query;

    if (!companyId || !clientId) {
      return res.status(400).json({ message: "companyId required" });
    }

    const docs = await PriceListPage.find({
      companyId,
      clientId,
    })
      .sort({ updatedAt: -1 })   // 🔥 LATEST FIRST
      .lean();

    return res.status(200).json({
      count: docs.length,
      data: docs,
    });
  } catch (err) {
    console.error("GET ALL PRICE LIST ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
};


/* ===========================
   UTILITY: ENSURE DIRECTORY
=========================== */
const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};


const importPriceListFromCSV = async (req, res) => {
  const clientId = req.user.clientID;
  const { companyId } = req.body;
  const priceLevelCache = new Set();


  try {
    /* ===== BASIC VALIDATIONS ===== */
    if (!req.file) {
      return res.status(400).json({ message: "CSV file required" });
    }

    if (!companyId) {
      return res.status(400).json({ message: "companyId required" });
    }

    const rows = await csv().fromFile(req.file.path);
    if (!rows.length) {
      return res.status(400).json({ message: "Empty CSV file" });
    }

    /* ===== DATA HOLDERS ===== */
    const grouped = {};
    const missingProducts = [];
    const duplicatePriceLists = [];

    /* ===========================
       PROCESS EACH ROW (SAFE)
    ============================ */
    for (const r of rows) {
      try {
        if (!r.itemName || !r.priceLevel || !r.applicableFrom) continue;

        /* ===== PRODUCT CHECK ===== */
        const product = await Product.findOne({
          companyId,
          name: r.itemName,
        });

        if (!product) {
          missingProducts.push({
            itemName: r.itemName,
            priceLevel: r.priceLevel,
            applicableFrom: r.applicableFrom,
          });
          continue;
        }
        /* ===== PRICE LEVEL CHECK ===== */
if (!priceLevelCache.has(r.priceLevel)) {
  const exists = await PriceLevel.findOne({
    name: r.priceLevel,
    companyId,
    clientId,
  });

  if (!exists) {
    await PriceLevel.create({
      name: r.priceLevel,
      companyId,
      clientId,
    });
  }

  priceLevelCache.add(r.priceLevel);
}
    /* ===== PAGE LEVEL GROUP KEY ===== */
        const key = [
          companyId,
          clientId,
          r.priceLevel,
          r.stockGroupName || "",
          r.applicableFrom,
          Number(r.page || 1),
        ].join("|");

        /* ===== INIT PAGE ===== */
        if (!grouped[key]) {
          grouped[key] = {
            companyId: new mongoose.Types.ObjectId(companyId),
            clientId: new mongoose.Types.ObjectId(clientId),
            priceLevel: r.priceLevel,
            stockGroupName: r.stockGroupName,
            applicableFrom: r.applicableFrom,
            page: Number(r.page || 1),
            items: [],
          };
        }

        /* ===== ITEM MERGE ===== */
        let item = grouped[key].items.find(
          (i) => i.itemId.toString() === product._id.toString()
        );

        if (!item) {
          item = {
            itemId: product._id,
            itemName: product.name,
            slabs: [],
          };
          grouped[key].items.push(item);
        }

        /* ===== SLAB ADD ===== */
        if (Number(r.rate) > 0 || Number(r.discount) > 0) {
          item.slabs.push({
            fromQty: Number(r.fromQty) || 0,
            lessThanQty:
              r.lessThanQty === "" || r.lessThanQty === null
                ? null
                : Number(r.lessThanQty),
            rate: Number(r.rate) || 0,
            discount: Number(r.discount) || 0,
          });
        }
      } catch (rowErr) {
        console.error("ROW ERROR:", rowErr);
      }
    }

    /* ===========================
       SAVE / DUPLICATE CHECK
    ============================ */
    let pagesSaved = 0;

    for (const doc of Object.values(grouped)) {
      const exists = await PriceListPage.findOne({
        companyId: doc.companyId,
        clientId: doc.clientId,
        priceLevel: doc.priceLevel,
        stockGroupName: doc.stockGroupName,
        applicableFrom: doc.applicableFrom,
        page: doc.page,
      });

      if (exists) {
        duplicatePriceLists.push({
          priceLevel: doc.priceLevel,
          applicableFrom: doc.applicableFrom,
          page: doc.page,
        });
        continue;
      }

      if (doc.items.length) {
        await PriceListPage.create(doc);
        pagesSaved++;
      }
    }

    /* ===========================
       CSV EXPORT
    ============================ */
    const uploadDir = path.join(__dirname, "../uploads");
    ensureDirExists(uploadDir);

    const downloadFiles = [];

    if (missingProducts.length) {
      const parser = new Parser();
      const csvData = parser.parse(missingProducts);
      const filePath = path.join(uploadDir, "missing-products.csv");
      fs.writeFileSync(filePath, csvData);
      downloadFiles.push(filePath);
    }

    if (duplicatePriceLists.length) {
      const parser = new Parser();
      const csvData = parser.parse(duplicatePriceLists);
      const filePath = path.join(uploadDir, "duplicate-price-lists.csv");
      fs.writeFileSync(filePath, csvData);
      downloadFiles.push(filePath);
    }

const archiver = require("archiver");
/* ===========================
   SEND ZIP FILE
=========================== */
if (missingProducts.length || duplicatePriceLists.length) {
  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=price-list-import-report.zip"
  );

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(res);

  if (missingProducts.length) {
    const parser = new Parser();
    const csvData = parser.parse(missingProducts);
    archive.append(csvData, { name: "missing-products.csv" });
  }

  if (duplicatePriceLists.length) {
    const parser = new Parser();
    const csvData = parser.parse(duplicatePriceLists);
    archive.append(csvData, { name: "duplicate-price-lists.csv" });
  }

  await archive.finalize();
  return;
}

  } catch (err) {
    console.error("PRICE LIST CSV IMPORT ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
};



const getPriceListById = async (req, res) => {
  try {
    const { id } = req.params;
console.log(id)
    const doc = await PriceListPage.findById(id);
console.log(doc)
    if (!doc) {
      return res.status(404).json({ message: "Price list not found" });
    }

    res.status(200).json({ data: doc });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


const updatePriceListPage = async (req, res) => {
  try {
    const { id } = req.params;
     const clientId = req.user.clientID;
    const {
      priceLevel,
      applicableFrom,
      page,
      items,
      stockGroupId,
      stockGroupName,
      companyId,
    
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({
        message: "No items to update",
      });
    }

    // 🔥 delete old page data
    await PriceListPage.deleteMany({
      _id: id,
    });

    // 🔥 insert updated document
    const doc = await PriceListPage.create({
      _id: id,
      companyId,
      clientId,
      priceLevel,
      applicableFrom,
      page,
      stockGroupId,
      stockGroupName,
      items,
    });

    res.status(200).json({
      success: true,
      data: doc,
      message: "Price list updated successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to update price list",
      err
    });
  }
};

const deletePriceList = async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = req.user.clientID;

    const deleted = await PriceListPage.findOneAndDelete({
      _id: id,
      clientId,
    });

    if (!deleted) {
      return res.status(404).json({
        message: "Price list not found",
      });
    }

    return res.json({
      message: "Price list deleted successfully",
    });
  } catch (err) {
    console.error("DELETE PRICE LIST ERROR:", err);
    return res.status(500).json({
      message: "Failed to delete price list",
    });
  }
};

module.exports =  {getAllPriceList, savePriceListPage,importPriceListFromCSV , getPriceListById, updatePriceListPage,deletePriceList} ;


