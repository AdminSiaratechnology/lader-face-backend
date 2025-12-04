const express = require("express");
const router = express.Router();

const {
  createTemplate,
  getTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  getActiveTemplate,
  getTemplatesByCompany
} = require("../controllers/billTemplateController");


// Create a new template
router.post("/", createTemplate);

// Get all active templates
router.get("/", getTemplates);

// Get active template (single active one)
router.get("/active", getActiveTemplate);

// Get template by ID
router.get("/:id", getTemplateById);

// Update template
router.put("/:id", updateTemplate);

// Soft delete template
router.delete("/:id", deleteTemplate);

router.get("/company/:companyId", getTemplatesByCompany);
module.exports = router;
