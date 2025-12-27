
const csv = require("csvtojson");
const mongoose = require("mongoose");
const PriceListPage =  require("../models/PriceListPage");

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


const importPriceListFromCSV = async (req, res) => {
  const clientId = req.user.clientID;
  const { companyId } = req.body;

  try {
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

    const grouped = {};

    rows.forEach((r) => {
      if (!r.stockGroupName || !r.priceLevel || !r.applicableFrom) return;

      const key = [
        companyId,
        r.priceLevel,
        r.stockGroupName,
        r.applicableFrom,
        Number(r.page || 1),
      ].join("|");

      if (!grouped[key]) {
        grouped[key] = {
          companyId: new mongoose.Types.ObjectId(companyId),
          clientId: new mongoose.Types.ObjectId(clientId),
          priceLevel: r.priceLevel,
          stockGroupName: r.stockGroupName,
          applicableFrom: r.applicableFrom,
          page: Number(r.page || 1),
          items: [
            {
              itemId: null,
              itemName: r.itemName,
              slabs: [],
            },
          ],
        };
      }

      if (Number(r.rate) > 0 || Number(r.discount) > 0) {
        grouped[key].items[0].slabs.push({
          fromQty: Number(r.fromQty),
          lessThanQty:
            r.lessThanQty === "" || r.lessThanQty === null
              ? null
              : Number(r.lessThanQty),
          rate: Number(r.rate) || 0,
          discount: Number(r.discount) || 0,
        });
      }
    });

    const docs = Object.values(grouped).filter(
      (d) => d.items[0].slabs.length > 0
    );

    for (const d of docs) {
      await PriceListPage.findOneAndUpdate(
        {
          companyId: d.companyId,
          clientId: d.clientId,
          priceLevel: d.priceLevel,
          stockGroupName: d.stockGroupName,
          applicableFrom: d.applicableFrom,
          page: d.page,
        },
        d,
        { upsert: true, new: true }
      );
    }

    return res.status(200).json({
      message: "Price List imported successfully",
      pagesSaved: docs.length,
    });
  } catch (err) {
    console.error("PRICE LIST CSV IMPORT ERROR:", err);
    return res.status(500).json({ message: err.message });
  }
};



const getPriceListById = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await PriceListPage.findById(id);

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



module.exports =  {getAllPriceList, savePriceListPage,importPriceListFromCSV , getPriceListById, updatePriceListPage} ;


