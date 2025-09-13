// src/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// If using multer for images, configure middleware in app and attach files to req.files.images
// e.g. upload.array('images', 10) or upload.fields([{ name:'images', maxCount:10 }])

router.post('/', productController.createProduct);           // create (form-data allowed)
router.put('/:id', productController.updateProduct);         // update (form-data allowed)
router.delete('/:id', productController.deleteProduct);      // delete
router.get('/:id', productController.getProductById);        // get by id
router.get('/', productController.listProducts);             // list / filter

module.exports = router;
