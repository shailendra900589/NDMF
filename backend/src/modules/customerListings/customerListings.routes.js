const express = require('express');
const router = express.Router();
const listings = require('./customerListings.controller');
const { authMiddleware, requireRole } = require('../../middleware/authMiddleware');
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);

router.get('/', authMiddleware, listings.getAll);
router.get('/approval', authMiddleware, listings.getForApproval);
router.get('/:id', authMiddleware, listings.getById);
router.post('/', authMiddleware, listings.submit);
router.post('/approve', authMiddleware, requireRole('branchManager', 'admin'), wrap(listings.processApproval));
router.put('/:id/assign', authMiddleware, requireRole('branchManager', 'admin'), listings.assignOfficer);

module.exports = router;
