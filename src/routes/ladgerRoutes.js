const express = require("express");
const {
  
  createLedger,
  updateLedger,
  getLedgerById,
  getLedgersByClient,
  getLedgersByCompany,
  deleteLedger,
  createBulkLedgers
  
} = require("../controllers/ladgerController");
const upload = require("../config/s3");

const router = express.Router();

// Create agent
router.post("/", upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "registrationDocs", maxCount: 5 },
  ]), createLedger);
  router.post("/bulk", createBulkLedgers);

// Update agent
router.put("/:id",upload.fields([
   
    { name: "registrationDocs", maxCount: 5 },
  ]),  updateLedger);

// Get all agents by company
router.get("/:companyId", getLedgersByCompany);
// router.get("/", getLedgersByClient);
// // Get all agents by company
// router.get("/", getAgentsByCompany);

// Get agent by id
router.get("/:id", getLedgerById);
router.delete("/:id",deleteLedger)

module.exports = router;