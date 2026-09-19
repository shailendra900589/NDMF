const express = require('express');
const router = express.Router();
const auth = require('./auth.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');

// POST /api/v1/auth/login
router.post('/login', auth.login);

// POST /api/v1/auth/otp/send
router.post('/otp/send', auth.sendOtp);

// POST /api/v1/auth/otp/verify
router.post('/otp/verify', auth.verifyOtp);

// GET /api/v1/auth/me  (token required)
router.get('/me', authMiddleware, auth.me);

// POST /api/v1/auth/logout
router.post('/logout', authMiddleware, auth.logout);

// PUT /api/v1/auth/change-password
router.put('/change-password', authMiddleware, auth.changePassword);

// PUT /api/v1/auth/profile
router.put('/profile', authMiddleware, auth.updateProfile);

module.exports = router;
