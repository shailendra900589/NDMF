# Backend - Express API

Nirmaldhara Micro Foundation ka REST API backend.

## Quick Start

```bash
cd backend
copy .env.example .env
npm install
npm run seed
npm run dev
```

Server: `http://localhost:5000/api/v1`

**Demo users:** see [../DEMO_LOGINS.md](../DEMO_LOGINS.md) — password `ndfa1234` for all roles.

## Folder Structure

```
backend/
├── data/db.json          ← Saara data yahan (manually edit kar sakte ho)
├── uploads/              ← Uploaded photos/audio
├── src/
│   ├── index.js          ← Server start
│   ├── app.js            ← Express setup
│   ├── config/env.js     ← Environment variables
│   ├── lib/
│   │   ├── db.js         ← JSON database read/write
│   │   └── response.js   ← Standard API response format
│   ├── middleware/
│   │   ├── authMiddleware.js  ← JWT + role check
│   │   └── errorHandler.js
│   ├── routes/index.js   ← All routes mount
│   ├── modules/          ← Har feature ka alag folder
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── leads/
│   │   ├── loans/
│   │   ├── customers/
│   │   ├── customerListings/
│   │   ├── attendance/
│   │   ├── tracking/
│   │   └── upload/
│   └── seed/seedData.js  ← Demo data
```

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | /auth/login | Login |
| POST | /auth/otp/send | Send OTP |
| POST | /auth/otp/verify | Verify OTP |
| GET | /dashboard/stats | Dashboard stats |
| GET | /leads | List leads |
| POST | /leads/accept | Accept lead |
| GET | /loans | List loans |
| POST | /loans | Submit loan |
| PUT | /loans/:id/verify | Save verification |
| POST | /loans/approve | Approve/reject loan |
| GET | /customer-listings | List customer listings |
| POST | /customer-listings | Submit listing |
| POST | /customer-listings/approve | Approve listing |
| GET | /customers | List customers |
| POST | /attendance/check-in | Check in |
| POST | /attendance/check-out | Check out |
| POST | /uploads/single | Upload photo |

Full guide: `../SETUP_GUIDE.md`
