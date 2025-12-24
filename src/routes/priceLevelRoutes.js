const express = require("express");
const router = express.Router();
const { createPriceLevel, getPriceLevels } = require("../controllers/priceLevelController");

router.post("/price-level", createPriceLevel);
router.get("/price-level", getPriceLevels);


module.exports = router;
