const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');
const validateCompany = require("../middlewares/validateCompanyMiddleware");


// Routes
router.post('/',validateCompany, unitController.createUnit);
router.put('/:id',validateCompany, unitController.updateUnit);
router.delete('/:id',validateCompany, unitController.deleteUnit);
router.get('/', unitController.getUnits);
router.get('/:companyId',validateCompany, unitController.getUnitsByCompanyId);

module.exports = router;
