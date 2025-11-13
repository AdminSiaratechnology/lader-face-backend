const express = require('express');
const router = express.Router();
const userManagement = require('../controllers/userManagementControler');
const upload = require('../config/s3');

router.get('/client/allUsers', userManagement.getAllClientUsers);
// router.get('/client/:companyId', userManagement.getAllClientUsersWithCompany);
router.put('/profile/update', upload.fields([{ name: 'profile', maxCount: 1 }]), userManagement.updateUserProfile);
router.get('/partners', userManagement.getPartners);
module.exports = router;