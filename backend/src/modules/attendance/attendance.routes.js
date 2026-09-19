const express = require('express');
const router = express.Router();
const attendance = require('./attendance.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');

router.post('/check-in', authMiddleware, attendance.checkIn);
router.post('/check-out', authMiddleware, attendance.checkOut);
router.get('/history', authMiddleware, attendance.getHistory);

module.exports = router;
