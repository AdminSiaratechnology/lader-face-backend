const express = require('express');
const router = express.Router();
const userManagement = require('../controllers/userManagementControler');

router.get('/client/allUsers', userManagement.getAllClientUsersWithCompany);
router.get('/client/:companyId', userManagement.getAllClientUsersWithCompany);


module.exports = router;