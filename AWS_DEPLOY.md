# AWS Production — ndclients.co.in

Domain: **https://ndclients.co.in**  
API: **https://ndclients.co.in/api/v1**  
Admin: **https://ndclients.co.in**

## Update the existing EC2 deployment

```bash
cd ~/NDMF &&
git pull --ff-only origin main &&
bash deploy/update-production.sh
```

The update script builds the console, publishes it to Nginx's `/var/www/ndmf` directory, restarts the API and checks that the live login page references the new build. Building `admin-frontend/dist` alone does not update the website served by this host. Existing environment files and company data are preserved. If Nginx uses another document root, set `ADMIN_WEB_ROOT` to that directory when running the script.

## Pull on server

```bash
cd ~/NDMF
git pull origin main
```

## Backend env

```bash
cd ~/NDMF/backend
cp .env.example .env
# edit if needed — defaults already use ndclients.co.in + JWT
nano .env
npm ci --omit=dev
npm run seed   # first time only
npm start
# or: pm2 restart ndfa-api
```

Required keys (see `.env.example`):

```
JWT_SECRET=ndclients_ndfa_jwt_secret_2026_change_on_server_if_needed
FRONTEND_URL=https://ndclients.co.in
CORS_ORIGINS=https://ndclients.co.in,https://www.ndclients.co.in
PUBLIC_API_URL=https://ndclients.co.in/api/v1
TRUST_PROXY=true
```

## Admin build

```bash
cd ~/NDMF/admin-frontend
cp .env.example .env.production
npm ci
npm run build
# deploy dist/ behind nginx on ndclients.co.in
```

`VITE_API_BASE=https://ndclients.co.in/api/v1`

## Mobile

`api_constants.dart` already has:

- `useProduction = true`
- `productionBaseUrl = https://ndclients.co.in/api/v1`

## Nginx (same host)

Proxy `/api/` and `/uploads/` to Node `:5000`, serve admin `dist/` on `/`.

## Login

See **DEMO_LOGINS.md** — Admin `9000000001` / `ndfa1234` @ https://ndclients.co.in
