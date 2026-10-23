const express = require('express');
const router = express.Router();
const branches = require('./branches.controller');
const { authMiddleware, requireRole } = require('../../middleware/authMiddleware');
const wrap=handler=>(req,res,next)=>Promise.resolve(handler(req,res)).catch(next);

router.get('/', authMiddleware, branches.getAll);
router.post('/', authMiddleware, requireRole('admin'), wrap(branches.create));
router.put('/:id', authMiddleware, requireRole('admin'), wrap(branches.update));
router.delete('/:id', authMiddleware, requireRole('admin'), wrap(branches.remove));

module.exports = router;
