# ENV files — ndclients.co.in

## Source of truth (pushed)

| File | Copy on server to |
|------|-------------------|
| `deploy/ndclients.backend.env` | `backend/.env` |
| `deploy/ndclients.admin.env` | `admin-frontend/.env.production` |

Admin uses **`VITE_API_BASE=/api/v1`** (same-origin) so IP + domain both work.

## Quick apply on AWS

```bash
cd ~/NDMF
git pull origin main
chmod +x deploy/fix-all.sh
bash deploy/fix-all.sh
```

DNS A record still required for HTTPS — see `deploy/DNS_SSL.md`.

## Until domain DNS works

Open: **http://13.60.224.155/** (not https)
Login: `9000000001` / `ndfa1234`
