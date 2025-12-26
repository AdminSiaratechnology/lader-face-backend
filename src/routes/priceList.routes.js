const express = require("express");
const router = express.Router();
const multer = require("multer");   // ✅ MISSING

const {
  savePriceListPage,
  getAllPriceList,
  importPriceListFromCSV,
  getPriceListById,
} = require("../controllers/priceList.controller");

// ✅ DEFINE UPLOAD
const upload = multer({ dest: "uploads/" });

router.post("/price-list/items", savePriceListPage);
router.get("/price-list", getAllPriceList);

router.post(
  "/price-list/import-csv",
  upload.single("file"),
  importPriceListFromCSV
);
router.get("/price-list/:id", getPriceListById);


module.exports = router;
