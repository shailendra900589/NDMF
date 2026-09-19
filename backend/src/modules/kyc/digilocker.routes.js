const express = require('express');
const router = express.Router();
const digilocker = require('./digilocker.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');

/** Public — Cashfree redirect after customer completes DigiLocker */
router.get('/callback', digilocker.callback);

router.post('/verify-account', authMiddleware, digilocker.verifyAccount);
router.post('/create-url', authMiddleware, digilocker.createUrl);
router.get('/status', authMiddleware, digilocker.getStatus);
router.get('/document/:documentType', authMiddleware, digilocker.getDocument);
router.post('/complete', authMiddleware, digilocker.complete);
router.get('/subject/:subjectType/:subjectId', authMiddleware, digilocker.getSubjectKyc);

module.exports = router;
