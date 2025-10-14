const  express= require( "express");
const  {
  createStockItems,
  getAllClientStockItems,
  getStockItemByCode,
  updateStockItem,
  changeStockItemStatus,
  softDeleteStockItem,
  generateStockItemsDocumentationPDF
} = require("../controllers/stockItem.controller.js");
const upload = require("../config/s3");


const router = express.Router();

router.post("/create",upload.none(), createStockItems);
router.get("/",upload.none(), getAllClientStockItems);
router.get("/:code",upload.none(), getStockItemByCode);
router.put("/:id",upload.none(), updateStockItem);
router.patch("/:id/status",upload.none(), changeStockItemStatus);
router.delete("/:id",upload.none(), softDeleteStockItem);
router.get("/documentation/pdf",upload.none(), generateStockItemsDocumentationPDF);

module.exports = router;
