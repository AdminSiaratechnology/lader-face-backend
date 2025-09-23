const express = require("express");
const {
  
  createLedger,
  updateLedger,
  getLedgerById,
  getLedgersByClient,
  getLedgersByCompany,
  deleteLedger
  
} = require("../controllers/ladgerController");
const upload = require("../config/s3");

const router = express.Router();

// Create agent
router.post("/",upload.fields([
   
    { name: "registrationDocs", maxCount: 5 },
  ]), createLedger);

// Update agent
router.put("/:id",upload.fields([
   
    { name: "registrationDocs", maxCount: 5 },
  ]),  updateLedger);

// Get all agents by company
router.get("/", getLedgersByClient);
// // Get all agents by company
// router.get("/", getAgentsByCompany);

// Get agent by id
router.get("/:id", getLedgerById);
router.delete("/:id",deleteLedger)

module.exports = router;