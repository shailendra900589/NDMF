/**
 * ENV CONFIG — production: ndclients.co.in (JWT + CORS + FRONTEND_URL)
 */
require('dotenv').config();

const frontendUrl = process.env.FRONTEND_URL || 'http://13.60.224.155';
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : [
      frontendUrl,
      'http://13.60.224.155',
      'https://13.60.224.155',
      'https://ndclients.co.in',
      'https://www.ndclients.co.in',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];

module.exports = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret:
    process.env.JWT_SECRET || 'ndclients_ndfa_jwt_secret_2026_ndclients_co_in',
  frontendUrl,
  corsOrigins,
  publicApiUrl: process.env.PUBLIC_API_URL || 'http://13.60.224.155/api/v1',
  trustProxy: process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production',
};
