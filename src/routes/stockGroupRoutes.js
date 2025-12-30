const express = require("express");
const router = express.Router();
const stockGroupController = require("../controllers/stockGroupController");
const validateCompany = require("../middlewares/validateCompanyMiddleware");

router.post("/",validateCompany, stockGroupController.createStockGroup);
router.get("/",validateCompany, stockGroupController.getStockGroups);
router.get("/:companyId",validateCompany, stockGroupController.getStockGroupsByCompany);
router.put("/:id",validateCompany, stockGroupController.updateStockGroup);
router.delete("/:id", stockGroupController.deleteStockGroup);
module.exports = router;