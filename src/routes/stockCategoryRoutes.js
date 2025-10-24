const express = require("express");
const router = express.Router();
const stockCategoryController = require("../controllers/stockCategoryController");

router.post("/", stockCategoryController.createStockCategory);
router.get("/", stockCategoryController.getStockCategories);
router.get("/:companyId", stockCategoryController.getStockCategoriesByCompanyId);
router.put("/:id", stockCategoryController.updateStockCategory);
router.delete("/:id", stockCategoryController.deleteStockCategory);

module.exports = router;