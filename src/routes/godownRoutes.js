const express = require("express");
const router = express.Router();
const godownController = require("../controllers/godownController");
const upload = require("../config/s3");

// Create
// router.get("/",(req,res)=>{
//     console.log("hello");
//     res.send("hello");
// });
router.post("/", upload.none(), godownController.createGodown);

// Get All
// router.get("/", godownController.getGodowns);

// Get by ID
// router.get("/:id", godownController.getGodownById);

// Get by Company
router.get("/:companyId", godownController.getGodownsByCompany);

// Update
router.put("/:id",upload.none(), godownController.updateGodown);

// Delete
router.delete("/:id", godownController.deleteGodown);

module.exports = router;
