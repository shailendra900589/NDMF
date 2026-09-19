const express = require('express');
const router = express.Router();
const leads = require('./leads.controller');
const { authMiddleware, requireRole } = require('../../middleware/authMiddleware');

router.get('/', authMiddleware, leads.getAll);
router.get('/:id', authMiddleware, leads.getById);
router.post('/', authMiddleware, requireRole('admin', 'branchManager'), leads.create);
router.post('/accept', authMiddleware, leads.accept);
router.patch('/:id/status', authMiddleware, leads.updateStatus);

module.exports = router;
