const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../config/s3');


router.post('/register', authMiddleware,upload.fields([{ name: "documents", maxCount: 10 }]), authController.register);
router.post('/registerInside',authMiddleware, authController.registerInside);
router.post('/login', authController.loginClientPortal);
router.post('/login-management', authController.loginManagementPortal);

router.patch("/updateUser/:id",authMiddleware, upload.fields([{ name: "documents", maxCount: 10 }]), authController.updateUser)
router.delete("/deleteUser/:id",authMiddleware,authController.deleteUser);
router.put("/logout/:id", authController.logout);
router.post("/send-otp", authController.sendResetOTP);
router.post("/verify-otp",authController.verifyOTP );
// reset password (requires verified OTP)_
router.post("/reset-password", authController.resetPassword);


module.exports = router;

