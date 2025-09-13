const express = require("express");
const router = express.Router();
const godownController = require("../controllers/godownController");

// Create
// router.get("/",(req,res)=>{
//     console.log("hello");
//     res.send("hello");
// });
router.post("/", godownController.createGodown);

// Get All
router.get("/", godownController.getGodowns);

// Get by ID
router.get("/:id", godownController.getGodownById);

// Get by Company
router.get("/company/:companyId", godownController.getGodownsByCompany);

// Update
router.put("/:id", godownController.updateGodown);

// Delete
router.delete("/:id", godownController.deleteGodown);

module.exports = router;
