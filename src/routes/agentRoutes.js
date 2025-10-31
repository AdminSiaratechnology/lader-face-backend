const express = require("express");
const {
  createAgent,
  updateAgent,
  getAgentsByCompany,
  getAgentById,
  getAgentsByClient,
  deleteAgent,
  createBulkAgents
  
} = require("../controllers/agentController");
const upload = require("../config/s3");

const router = express.Router();

// Create agent
router.post("/", upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "registrationDocs", maxCount: 5 },
  ]), createAgent);
  router.post("/bulk", createBulkAgents);

// Update agent
router.put("/:id",upload.fields([
   
    { name: "registrationDocs", maxCount: 5 },
  ]),  updateAgent);

// Get all agents by company
// router.get("/", getAgentsByClient);
// // Get all agents by company
router.get("/:companyId", getAgentsByCompany);

// Get agent by id
router.get("/:id", getAgentById);
router.delete("/:id",deleteAgent)

module.exports = router;