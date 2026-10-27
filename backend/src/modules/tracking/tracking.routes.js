const express = require('express');
const router = express.Router();
const tracking = require('./tracking.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');

router.post('/live-ping', authMiddleware, tracking.livePing);
router.post('/heartbeat', authMiddleware, tracking.heartbeat);
router.get('/live', authMiddleware, tracking.getLiveTeam);
router.post('/route-points', authMiddleware, tracking.saveRoutePoints);
router.get('/today', authMiddleware, tracking.getToday);
router.get('/route', authMiddleware, tracking.getRoute);
router.get('/people', authMiddleware, tracking.getPeople);
router.get('/days', authMiddleware, tracking.getDays);
router.get('/history', authMiddleware, tracking.getHistory);

module.exports = router;
