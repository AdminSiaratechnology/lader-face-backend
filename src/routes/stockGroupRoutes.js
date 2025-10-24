const express = require("express");
const router = express.Router();
const stockGroupController = require("../controllers/stockGroupController");

router.post("/", stockGroupController.createStockGroup);
router.get("/", stockGroupController.getStockGroups);
router.get("/:companyId", stockGroupController.getStockGroupsByCompany);
router.put("/:id", stockGroupController.updateStockGroup);
router.delete("/:id", stockGroupController.deleteStockGroup);
module.exports = router;