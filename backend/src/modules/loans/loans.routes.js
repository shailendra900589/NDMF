const express = require('express');
const router = express.Router();
const loans = require('./loans.controller');
const { authMiddleware, requireRole } = require('../../middleware/authMiddleware');

router.get('/', authMiddleware, loans.getAll);
router.get('/approval', authMiddleware, loans.getForApproval);
router.get('/:id', authMiddleware, loans.getById);
router.post('/', authMiddleware, loans.submit);
router.put('/:id/verify', authMiddleware, loans.saveVerification);
router.post('/approve', authMiddleware, requireRole('branchManager', 'admin'), loans.processApproval);
router.post('/:id/disburse', authMiddleware, requireRole('admin'), loans.disburse);

module.exports = router;
