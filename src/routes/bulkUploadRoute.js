const express = require("express");
const router = express.Router();
const { createBulkUpload } = require("../controllers/bulkuploadController");

router.post("/:type",  createBulkUpload);

module.exports = router;