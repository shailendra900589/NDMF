const express = require('express');
const router = express.Router();
const payslips = require('./payslips.controller');
const { authMiddleware, requireRole } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
// Admin only — pay slips
router.use(authMiddleware, requireRole('admin'), requirePermission('payslips'));

router.get('/', payslips.list);
router.get('/calculation', payslips.calculation);
router.post('/bulk', wrap(payslips.bulkUpsert));
router.get('/:id', payslips.getById);
router.post('/', wrap(payslips.create));
router.put('/:id', wrap(payslips.update));
router.post('/:id/add-month', wrap(payslips.addMonth));
router.delete('/:id', wrap(payslips.remove));

module.exports = router;
