# Nirmaldhara Micro Foundation (NDFA / NDMF)

**Production:** [https://ndclients.co.in](https://ndclients.co.in)  
**API:** [https://ndclients.co.in/api/v1](https://ndclients.co.in/api/v1)

Field app: Customer Listing, Dialer + recordings, Attendance, GPS Tracking, RBAC + branch scope.

```
NDMF/
├── mobile-app/       Flutter (production → ndclients.co.in)
├── backend/          Express API + JWT
├── admin-frontend/   React admin
├── deploy/           Docker / nginx
└── AWS_DEPLOY.md
```

## Local quick start

```bash
cd backend && cp .env.example .env && npm install && npm run seed && npm run dev
cd admin-frontend && npm install && npm run dev
cd mobile-app && flutter pub get && flutter run
```

For local mobile testing set `useProduction = false` in `api_constants.dart`.

## AWS

```bash
cd ~/NDMF
git pull origin main
```

Then configure `.env` from `.env.example` (JWT + ndclients.co.in already filled). See [AWS_DEPLOY.md](AWS_DEPLOY.md).

## Logins

[DEMO_LOGINS.md](DEMO_LOGINS.md) — Admin `9000000001` / `ndfa1234`
