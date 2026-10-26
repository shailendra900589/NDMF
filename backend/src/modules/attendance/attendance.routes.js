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
router.get('/operations', authMiddleware, attendance.getOperations);
router.put('/schedules', authMiddleware, wrap(attendance.saveSchedule));
router.delete('/schedules/:id', authMiddleware, wrap(attendance.removeSchedule));
router.post('/festivals', authMiddleware, wrap(attendance.saveFestival));
router.delete('/festivals/:id', authMiddleware, wrap(attendance.removeFestival));
router.put('/adjustment', authMiddleware, wrap(attendance.adjust));
router.put('/salary/:userId', authMiddleware, wrap(attendance.setSalary));
router.get('/enrollment/:userId', authMiddleware, attendance.getEnrollmentPhotos);

module.exports = router;
