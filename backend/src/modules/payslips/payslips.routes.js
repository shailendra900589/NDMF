const express = require('express');
const router = express.Router();
const payslips = require('./payslips.controller');
const { authMiddleware, requireRole } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

// Admin only — pay slips
router.use(authMiddleware, requireRole('admin'), requirePermission('payslips'));

router.get('/', payslips.list);
router.get('/:id', payslips.getById);
router.post('/', payslips.create);
router.put('/:id', payslips.update);
router.post('/:id/add-month', payslips.addMonth);
router.delete('/:id', payslips.remove);

module.exports = router;
