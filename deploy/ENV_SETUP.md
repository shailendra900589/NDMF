# ENV files — ndclients.co.in

## Files created

| File | Where it goes | Git |
|------|---------------|-----|
| `deploy/ndclients.backend.env` | copy → `backend/.env` | ✅ pushed |
| `deploy/ndclients.admin.env` | copy → `admin-frontend/.env.production` | ✅ pushed |
| `backend/.env` | already on your PC | ❌ not pushed (gitignore) |
| `admin-frontend/.env.production` | admin build | ✅ pushed |

## AWS (after git pull)

```bash
cd ~/NDMF
git pull origin main

# 1) Backend .env
cp deploy/ndclients.backend.env backend/.env

# 2) Admin env
cp deploy/ndclients.admin.env admin-frontend/.env.production

# 3) Start backend
cd backend
npm ci --omit=dev
npm start

# 4) Build admin
cd ../admin-frontend
npm ci
npm run build
```

## Local PC

- Backend: `D:\Laravel\NDFA\backend\.env` (already written)
- Admin: `D:\Laravel\NDFA\admin-frontend\.env.production` (already written)
