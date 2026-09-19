/**
 * EXPRESS APP SETUP
 * -----------------
 * Middleware, CORS, routes sab yahan configure hota hai.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const { corsOrigins, trustProxy } = require('./config/env');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

if (trustProxy) app.set('trust proxy', 1);

// JSON body parse
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS - React admin aur Flutter app dono connect kar saken
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// Uploaded files — correct MIME + inline streaming headers
const MIME_TYPES = {
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
};

app.use('/uploads', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  if (MIME_TYPES[ext]) {
    res.setHeader('Content-Type', MIME_TYPES[ext]);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', 'inline');
  }
  next();
}, express.static(path.join(__dirname, '../uploads')));

// API routes mount
app.use('/api/v1', apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}`, data: null });
});

// Error handler (last me)
app.use(errorHandler);

module.exports = app;
