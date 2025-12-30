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
const validateCompany = require("../middlewares/validateCompanyMiddleware");

const router = express.Router();

// Create agent
router.post("/", upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "registrationDocs", maxCount: 5 },
  ]),validateCompany, createLedger);
  router.post("/bulk", createBulkLedgers);

// Update agent
router.put("/:id",upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "registrationDocs", maxCount: 5 },
  ]),validateCompany,  updateLedger);

// Get all agents by company
router.get("/:companyId",validateCompany, getLedgersByCompany);
// router.get("/", getLedgersByClient);
// // Get all agents by company
// router.get("/", getAgentsByCompany);

// Get agent by id
router.get("/single/:id", getLedgerById);
router.delete("/:id",deleteLedger)

module.exports = router;