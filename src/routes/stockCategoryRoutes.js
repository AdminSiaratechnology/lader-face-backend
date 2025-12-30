const express = require("express");
const router = express.Router();
const stockCategoryController = require("../controllers/stockCategoryController");
const validateCompany = require("../middlewares/validateCompanyMiddleware");


router.post("/",validateCompany, stockCategoryController.createStockCategory);
router.get("/", stockCategoryController.getStockCategories);
router.get("/:companyId",validateCompany, stockCategoryController.getStockCategoriesByCompanyId);
router.put("/:id",validateCompany, stockCategoryController.updateStockCategory);
router.delete("/:id", stockCategoryController.deleteStockCategory);

module.exports = router;