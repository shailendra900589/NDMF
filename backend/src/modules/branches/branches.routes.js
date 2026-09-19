const express = require('express');
const router = express.Router();
const branches = require('./branches.controller');
const { authMiddleware, requireRole } = require('../../middleware/authMiddleware');

router.get('/', authMiddleware, branches.getAll);
router.post('/', authMiddleware, requireRole('admin'), branches.create);
router.put('/:id', authMiddleware, requireRole('admin'), branches.update);

module.exports = router;
