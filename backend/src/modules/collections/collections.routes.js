const express = require('express');
const router = express.Router();
const collections = require('./collections.controller');
const { authMiddleware, requireRole } = require('../../middleware/authMiddleware');

router.get('/', authMiddleware, collections.getAll);
router.get('/due-today', authMiddleware, collections.getDueToday);
router.post('/collect', authMiddleware, collections.collect);
router.post('/', authMiddleware, requireRole('admin', 'branchManager'), collections.create);

module.exports = router;
