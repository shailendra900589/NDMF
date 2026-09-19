const express = require('express');
const router = express.Router();
const tracking = require('./tracking.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');

router.post('/route-points', authMiddleware, tracking.saveRoutePoints);
router.get('/today', authMiddleware, tracking.getToday);
router.get('/history', authMiddleware, tracking.getHistory);

module.exports = router;
