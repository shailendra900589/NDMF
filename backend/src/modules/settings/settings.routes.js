const express = require('express');
const { authMiddleware } = require('../../middleware/authMiddleware');
const settings = require('./settings.controller');

const router = express.Router();

router.get('/public', authMiddleware, settings.getPublic);
router.put('/attendance-face', authMiddleware, settings.updateFaceAttendance);
router.put('/attendance-timing', authMiddleware, (req,res,next) => settings.updateTiming(req,res).catch(next));

module.exports = router;
