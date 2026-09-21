/**
 * ENV CONFIG — production: ndclients.co.in (JWT + CORS + FRONTEND_URL)
 */
require('dotenv').config();

const frontendUrl = process.env.FRONTEND_URL || 'https://ndclients.co.in';
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : [
      frontendUrl,
      'https://ndclients.co.in',
      'https://www.ndclients.co.in',
      'http://ndclients.co.in',
      'http://13.60.224.155',
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
  publicApiUrl: process.env.PUBLIC_API_URL || 'https://ndclients.co.in/api/v1',
  trustProxy: process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://ndfa:ndfa1234@127.0.0.1:5432/ndfa',
};
