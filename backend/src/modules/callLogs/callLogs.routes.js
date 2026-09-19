const express = require('express');
const router = express.Router();
const callLogs = require('./callLogs.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');

router.get('/', authMiddleware, callLogs.getAll);
router.post('/', authMiddleware, callLogs.create);
router.put('/:id', authMiddleware, callLogs.update);

module.exports = router;
