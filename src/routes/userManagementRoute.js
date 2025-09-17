const express = require('express');
const router = express.Router();
const userManagement = require('../controllers/userManagementControler');

router.get('/client/allUsers', userManagement.getAllClientUsers);


module.exports = router;