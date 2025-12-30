const express = require("express");
const router = express.Router();
const {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  bulkCreateCustomerGroups
} = require("../controllers/customerGroupController");
const validateCompany = require("../middlewares/validateCompanyMiddleware");


router.post("/create",validateCompany, createGroup);
router.post("/bulk-create",bulkCreateCustomerGroups );
router.get("/all", getGroups);
router.get("/:id", getGroupById);
router.put("/update/:id",validateCompany, updateGroup);
router.delete("/delete/:id", deleteGroup);

module.exports = router;