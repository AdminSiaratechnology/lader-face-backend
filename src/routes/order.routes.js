const express = require("express");
const router = express.Router();
const orderController = require("../controllers/order.controller");

router.post("/create", orderController.createOrder);
router.get("/report", orderController.getOrderReport);
router.get("/product-wise", orderController.getProductWiseReport);

router.put("/:id", orderController.updateOrder);
router.patch("/:id/status", orderController.updateOrderStatus);
router.patch("/:id/shipping", orderController.updateOrderDetails);

router.get("/:id", orderController.getOrderById);

router.get("/", orderController.getOrders);
router.get("/orderByCompany/:companyId", orderController.getOrdersByCompanyId);
router.get("/orderByUser/:companyId", orderController.getOrdersByCompanyId);
router.get("/state-wise/:companyId", orderController.getStateWiseSales);
router.get("/party-wise/:companyId", orderController.getPartyWiseSales);
router.get("/salesman-wise-sales/:companyId", orderController.getSalesmanWiseSales);
router.get("/today/:companyId", orderController.getTodaySales);
router.get("/monthly-comparison/:companyId", orderController.getMonthlySalesComparison);
router.get("/top-customers/:companyId", orderController.getTopCustomers);
router.get("/top-products/:companyId", orderController.getTopProducts);
router.get("/total-payment/:companyId", orderController.getTotalPayments);
router.get("/date-range/:companyId", orderController.getSalesByDateRange);
router.get("/salesman-personal-stats/:companyId", orderController.getSalesmanPersonalStats);
router.get("/orders-by-user/:companyId", orderController.getOrdersByUser);
router.get("/my-orders/:companyId", orderController.getOrdersByUser);
router.get("/getCustomerSalesStats/:companyId", orderController.getCustomerSalesStats);
router.get("/sales-trend/:companyId", orderController.getSalesTrend);



router.get("/:id/pdf",orderController.generateInvoicePDF)

module.exports = router;