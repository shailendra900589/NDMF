const express = require('express');
const router = express.Router();
const payslips = require('./payslips.controller');
const { authMiddleware, requireRole } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
// Admin only — pay slips
router.get('/mine', authMiddleware, (req,res)=>{
  const slips=require('../../lib/db').getCollection('payslips').filter(p=>req.user.employeeId && p.employeeNo===req.user.employeeId && p.slipReleasedAt).map(({salaryReleaseReference,createdBy,updatedBy,...p})=>p);
  return require('../../lib/response').success(res,slips);
});
router.use(authMiddleware, requireRole('admin'), requirePermission('payslips'));

router.get('/', payslips.list);
router.get('/calculation', payslips.calculation);
router.post('/run', wrap(payslips.runPayroll));
router.post('/bulk', wrap(payslips.bulkUpsert));
router.get('/:id', payslips.getById);
router.post('/', wrap(payslips.create));
router.put('/:id', wrap(payslips.update));
router.put('/:id/release', wrap(payslips.release));
router.post('/:id/add-month', wrap(payslips.addMonth));
router.delete('/:id', wrap(payslips.remove));

module.exports = router;
