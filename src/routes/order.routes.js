const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");

router.post("/create", orderController.createOrder);

router.put("/:id", orderController.updateOrder);
router.patch("/:id/status", orderController.updateOrderStatus);
router.patch("/:id/shipping", orderController.updateOrderDetails);

router.get("/:id", orderController.getOrderById);

router.get("/", orderController.getOrders);
router.get("/orderByCompany/:companyId", orderController.getOrdersByCompanyId);
router.get("/orderByUser/:companyId", orderController.getOrdersByCompanyId);

module.exports = router;
