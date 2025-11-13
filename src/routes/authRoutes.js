const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../config/s3');


router.post('/register', authMiddleware,upload.fields([{ name: "documents", maxCount: 10 }]), authController.register);
router.post('/registerInside',authMiddleware, authController.registerInside);
router.post('/login', authController.login);
router.patch("/updateUser/:id",authMiddleware, upload.fields([{ name: "documents", maxCount: 10 }]), authController.updateUser)
router.delete("/deleteUser/:id",authMiddleware,authController.deleteUser)

module.exports = router;

