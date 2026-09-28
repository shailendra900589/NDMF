const express = require('express');
const router = express.Router();
const attendance = require('./attendance.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { memoryUpload } = require('../../middleware/uploadMemory');

router.post('/verify-face', authMiddleware, memoryUpload.single('file'), attendance.verifyLiveFace);
router.post('/check-in', authMiddleware, attendance.checkIn);
router.post('/check-out', authMiddleware, attendance.checkOut);
router.get('/history', authMiddleware, attendance.getHistory);
router.get('/monthly', authMiddleware, attendance.getMonthly);

module.exports = router;
