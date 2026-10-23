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

The update script requires Node.js 20+, builds the console, restarts the API, waits for two consecutive valid health responses locally and through public HTTPS, then publishes the console to Nginx's `/var/www/ndmf` directory and checks the live build. Building `admin-frontend/dist` alone does not update the website served by this host. Existing environment files and company data are preserved. If Nginx uses another document root, set `ADMIN_WEB_ROOT` to that directory when running the script.

The first connection to port 5000 can be refused while the restarted process loads PostgreSQL and initializes the platform. The readiness check reports this as waiting, retries with a bounded timeout, and exits with an error if the API never becomes healthy. It also rejects HTML/proxy pages, malformed JSON and unsuccessful health payloads. A failed readiness check leaves the previous frontend entry document in place; backend rollback is not automatic.

For a persistent failure, run these on the server:

```bash
pm2 status
pm2 logs ndfa-api --nostream --lines 50
curl -fsS http://127.0.0.1:5000/api/v1/health
curl -fsS https://ndclients.co.in/api/v1/health
```

If local health succeeds but HTTPS fails, inspect the active Nginx `/api/` proxy and TLS configuration. If local health fails, inspect the application logs, PostgreSQL availability and `backend/.env` (`PORT`, `DATABASE_URL`). The PM2 `--update-env` message is informational; Ubuntu's reboot/update banner is separate operating-system maintenance, not proof of an API failure.

Validation: `python3 -m unittest discover -s deploy -p 'test_*.py'` checks cache configuration and readiness retries/failures. Frontend and backend lockfiles have been refreshed to resolve the reported npm audit findings, and Multer has been upgraded to its supported 2.x API with multipart regression coverage. Routing/session tests cover the React Router 7 update. Use `npm audit` within each app to check the current registry advisory state.

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
