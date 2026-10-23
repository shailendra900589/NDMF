const express = require('express');
const router = express.Router();
const wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
const attendance = require('./attendance.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');
const { memoryUpload } = require('../../middleware/uploadMemory');

router.post('/verify-face', authMiddleware, memoryUpload.single('file'), wrap(attendance.verifyLiveFace));
router.post('/check-in', authMiddleware, wrap(attendance.checkIn));
router.post('/check-out', authMiddleware, wrap(attendance.checkOut));
router.get('/history', authMiddleware, attendance.getHistory);
router.get('/monthly', authMiddleware, attendance.getMonthly);
router.get('/enrollment/:userId', authMiddleware, attendance.getEnrollmentPhotos);

module.exports = router;
