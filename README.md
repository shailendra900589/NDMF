# Nirmaldhara Micro Foundation (NDFA) — v2 Production

Field-force app: **Customer Listing**, **Dialer + Call Recordings**, **Attendance**, **GPS Tracking**, **RBAC + branch scope**.

**Removed:** Lead, Loan, New Loan, Approvals (mobile + admin + API routes).

```
NDFA/
├── mobile-app/       Flutter Android
├── backend/          Express API
├── admin-frontend/   React admin
├── deploy/           Dockerfiles
├── docker-compose.yml
└── AWS_DEPLOY.md
```

## Quick start

```bash
cd backend && npm install && npm run seed && npm run dev
cd admin-frontend && npm install && npm run dev
cd mobile-app && flutter pub get && flutter run
```

**Logins:** see [DEMO_LOGINS.md](DEMO_LOGINS.md) — e.g. Admin `9000000001` / `ndfa1234` @ http://localhost:5173

**AWS:** See [AWS_DEPLOY.md](AWS_DEPLOY.md)
