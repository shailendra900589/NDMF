const express = require('express');
const router = express.Router();
const uploadCtrl = require('./upload.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');

router.post('/single', authMiddleware, uploadCtrl.uploadMiddleware, uploadCtrl.uploadFile);
router.post('/multiple', authMiddleware, uploadCtrl.uploadMultipleMiddleware, uploadCtrl.uploadMultiple);

module.exports = router;
