const express = require('express');
const router = express.Router();
const constactController = require('../controllers/contactFormController');



router.post('/',constactController.createContactForm );




module.exports = router;

