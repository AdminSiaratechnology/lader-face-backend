// src/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../config/s3');
// const { multerUpload } = require("../middlewares/multer"); // we'll create this next
const csvUpload=require("../middlewares/csvUpload")


// If using multer for images, configure middleware in app and attach files to req.files.images
// e.g. upload.array('images', 10) or upload.fields([{ name:'images', maxCount:10 }])

router.post('/',
    upload.fields([
   
    { name: "productImages", maxCount: 5 },
  ]),
    productController.createProduct);           // create (form-data allowed)
router.put('/:id', upload.fields([
   
    { name: "productImages", maxCount: 5 },
  ]), productController.updateProduct);         // update (form-data allowed)
router.post('/bulk', productController.createBulkProducts); // bulk create
router.delete('/:id', productController.deleteProduct);      // delete
// router.get('/:id', productController.getProductById);        // get by id
// router.get('/', productController.listProducts);             // list / filter
router.get('/:companyId', productController.listProductsByCompanyId);             // list / filter
router.get("/:companyId/:groupId",productController.listProductsByCompanyId)
router.get('/stock-group/:companyId/:stockGroupId', productController.getProductsByStockGroupId); // get products by stock group id

router.post(
  "/import-csv",
  csvUpload.single("file"),
  productController.importProductsFromCSV

);

module.exports = router;
