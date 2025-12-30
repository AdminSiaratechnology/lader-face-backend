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
const validateCompany = require("../middlewares/validateCompanyMiddleware");

const router = express.Router();

// Create agent
router.post("/", upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "registrationDocs", maxCount: 5 },
  ]),validateCompany, createAgent);
  router.post("/bulk", createBulkAgents);

// Update agent
router.put("/:id",upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "registrationDocs", maxCount: 5 },
  ]),validateCompany,  updateAgent);

// Get all agents by company
// router.get("/", getAgentsByClient);
// // Get all agents by company
router.get("/:companyId",validateCompany, getAgentsByCompany);

// Get agent by id
router.get("/:id", getAgentById);
router.delete("/:id",deleteAgent)

module.exports = router;