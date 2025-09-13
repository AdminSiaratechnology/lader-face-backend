const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');

// Routes
router.post('/', unitController.createUnit);
router.put('/:id', unitController.updateUnit);
router.delete('/:id', unitController.deleteUnit);
router.get('/', unitController.getUnits);

module.exports = router;
