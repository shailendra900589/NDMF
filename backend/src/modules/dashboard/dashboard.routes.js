const express = require('express');
const router = express.Router();
const dashboard = require('./dashboard.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');

router.get('/stats', authMiddleware, dashboard.getStats);

module.exports = router;
