const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');


router.post('/register',authMiddleware, authController.register);
router.post('/login', authController.login);
router.patch("/updateUser/:id",authMiddleware,authController.updateUser)
router.delete("/deleteUser/:id",authMiddleware,authController.deleteUser)

module.exports = router;

