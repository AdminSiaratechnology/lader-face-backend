const express = require('express');
const router = express.Router();
const constactController = require('../controllers/contactFormController');



router.post('/create',constactController.createContactForm );




module.exports = router;

