const express = require('express');
const { streamRecording } = require('./media.controller');

const router = express.Router();

/** Accept Bearer header OR ?token= for HTML5 audio streaming */
function mediaAuth(req, res, next) {
  if (!req.headers.authorization && req.query.token) req.headers.authorization = `Bearer ${req.query.token}`;
  return require('../../middleware/authMiddleware').authMiddleware(req, res, next);
}

router.get('/stream', mediaAuth, streamRecording);

module.exports = router;
