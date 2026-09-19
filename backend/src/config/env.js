/**
 * ENV CONFIG — production (AWS): set JWT_SECRET, CORS_ORIGINS, FRONTEND_URL in .env
 */
require('dotenv').config();

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : [frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'];

module.exports = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'ndfa_dev_secret',
  frontendUrl,
  corsOrigins,
  trustProxy: process.env.TRUST_PROXY === 'true',
};
