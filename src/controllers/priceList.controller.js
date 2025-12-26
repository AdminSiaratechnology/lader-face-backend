
const csv = require("csvtojson");
const mongoose = require("mongoose");
const PriceListPage =  require("../models/PriceListPage");

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
    } = req.body;
    console.log(req.body);

    if (
      !companyId ||
      !clientId ||
      !priceLevel ||
      !stockGroupId ||
      !applicableFrom ||
      page === undefined ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    // 🔥 slab validation (optional but safe)
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

    return {
      ...item,
      slabs,
    };
  })
  .filter((i) => i.slabs.length > 0);


    if (cleanedItems.length === 0) {
      return res.status(400).json({ message: "No valid slabs to save" });
    }

    await  PriceListPage.findOneAndUpdate(
      {
        companyId,
        clientId,
        priceLevel,
        stockGroupId,
        applicableFrom,
        page,
      },
      {
        companyId,
        clientId,
        priceLevel,
        stockGroupId,
        stockGroupName,
        applicableFrom,
        page,
        items: cleanedItems,
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      message: `Page ${page} saved successfully`,
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
    }).sort({ priceLevel: 1, stockGroupName: 1, page: 1 });

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

  try {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file required" });
    }

    const rows = await csv().fromFile(req.file.path);

    if (!rows.length) {
      return res.status(400).json({ message: "Empty CSV file" });
    }

    const grouped = {};

    rows.forEach((r) => {
      if (!r.companyId || !r.itemId || !r.stockGroupId) return;

      const key = [
        r.companyId,
        r.priceLevel,
        r.stockGroupId,
        r.applicableFrom,
        r.page,
      ].join("|");

      if (!grouped[key]) {
        grouped[key] = {
          companyId: new mongoose.Types.ObjectId(r.companyId),
          clientId: new mongoose.Types.ObjectId(clientId),
          priceLevel: r.priceLevel,
          stockGroupId: new mongoose.Types.ObjectId(r.stockGroupId),
          stockGroupName: r.stockGroupName,
          applicableFrom: r.applicableFrom,
          page: Number(r.page),
          items: {},
        };
      }

      if (!grouped[key].items[r.itemId]) {
        grouped[key].items[r.itemId] = {
          itemId: new mongoose.Types.ObjectId(r.itemId),
          itemName: r.itemName,
          slabs: [],
        };
      }

      if (Number(r.rate) > 0 || Number(r.discount) > 0) {
        grouped[key].items[r.itemId].slabs.push({
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

    const docs = Object.values(grouped).map((g) => ({
      ...g,
      items: Object.values(g.items).filter(
        (i) => i.slabs.length > 0
      ),
    }));

    for (const d of docs) {
      if (!d.items.length) continue;

      await PriceListPage.findOneAndUpdate(
        {
          companyId: d.companyId,
          clientId: d.clientId,
          priceLevel: d.priceLevel,
          stockGroupId: d.stockGroupId,
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


module.exports =  {getAllPriceList, savePriceListPage,importPriceListFromCSV , getPriceListById} ;


