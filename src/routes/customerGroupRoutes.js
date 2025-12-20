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


router.post("/create", createGroup);
router.post("/bulk-create",bulkCreateCustomerGroups );
router.get("/all", getGroups);
router.get("/:id", getGroupById);
router.put("/update/:id", updateGroup);
router.delete("/delete/:id", deleteGroup);

module.exports = router;