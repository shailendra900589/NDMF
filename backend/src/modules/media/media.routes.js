const express = require('express');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../../config/env');
const { findById } = require('../../lib/db');
const { streamRecording } = require('./media.controller');

const router = express.Router();

/** Accept Bearer header OR ?token= for HTML5 audio streaming */
function mediaAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = (header && header.startsWith('Bearer ') ? header.split(' ')[1] : null) || req.query.token;
  if (!token) return res.status(401).json({ success: false, message: 'Login required' });
  try {
    const decoded = jwt.verify(token, jwtSecret);
    const user = findById('users', decoded.userId);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

router.get('/stream', mediaAuth, streamRecording);

module.exports = router;
