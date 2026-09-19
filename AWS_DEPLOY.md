# AWS Production Deployment — NDFA v2

Lead / Loan / Approval modules removed. Stack: Customer Listing, Collections, Calls, Attendance, Tracking.

## Backend (ECS/EC2)

```bash
cd backend
cp .env.example .env
npm ci --omit=dev
npm run seed
npm start
```

Docker: `docker compose up --build` (see `docker-compose.yml`)

## Admin (S3 + CloudFront)

```bash
cd admin-frontend
# .env.production: VITE_API_BASE=https://api.yourdomain.com/api/v1
npm run build
# deploy dist/
```

## Mobile

`api_constants.dart`: `useProduction = true`, set `productionBaseUrl`.

## Login

Demo logins: see **DEMO_LOGINS.md** — Admin `9000000001` / `ndfa1234` on dashboard.

See `docker-compose.yml` and `deploy/` for containers.
