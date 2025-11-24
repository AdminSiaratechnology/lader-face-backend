const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");

router.post("/add/:companyId", cartController.bulkAddToCart);

router.get("/:companyId", cartController.getCart);

router.put("/update/:companyId", cartController.updateCartItem);

router.delete("/remove/:id", cartController.removeCartItem);

router.delete("/clear/:companyId", cartController.clearCart);
module.exports = router;