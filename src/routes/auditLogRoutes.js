const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditLog.controller');
const authMiddleware = require('../middlewares/authMiddleware');


router.get('/client',authMiddleware, auditController.getAuditLogsByClient);
router.get('/client/all',authMiddleware, auditController.getAuditLogsByClientAllAudilog);
router.get('/client/detail/:id',authMiddleware, auditController.getAuditLogsByClientDetailByID);
router.patch('/client/restore',authMiddleware, auditController.restoreRecord);
router.get('/all', authMiddleware, auditController.getAllAuditLogs);
router.get('/detail/:id', authMiddleware, auditController.getAuditLogById);

module.exports = router;

