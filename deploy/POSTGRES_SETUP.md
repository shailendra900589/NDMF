# PostgreSQL setup on AWS Ubuntu (NDMF)

## 1) Fix port 5000 conflict (EADDRINUSE)

```bash
# Who is using 5000?
sudo ss -tlnp | grep 5000
# or
sudo lsof -i :5000

# Kill whatever holds the port
sudo fuser -k 5000/tcp

pm2 delete ndfa-api
pm2 flush
```

## 2) Install PostgreSQL

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

## 3) Create DB user + database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER ndfa WITH PASSWORD 'ndfa1234';
CREATE DATABASE ndfa OWNER ndfa;
GRANT ALL PRIVILEGES ON DATABASE ndfa TO ndfa;
\c ndfa
GRANT ALL ON SCHEMA public TO ndfa;
ALTER DATABASE ndfa OWNER TO ndfa;
SQL
```

Test:
```bash
psql "postgresql://ndfa:ndfa1234@127.0.0.1:5432/ndfa" -c "SELECT 1;"
```

## 4) Pull code + env + npm

```bash
cd ~/NDMF
git stash push -m temp -- admin-frontend/.env.production 2>/dev/null || true
mv -f admin-frontend/.env.production /tmp/env.prod.bak 2>/dev/null || true
git pull origin main

cp deploy/ndclients.backend.env backend/.env
cp deploy/ndclients.admin.env admin-frontend/.env.production

cd ~/NDMF/backend
npm ci
npm run seed
```

Seed creates demo users in PostgreSQL. Existing `data/db.json` auto-migrates on first API start if PG is empty.

## 5) Start API with pm2

```bash
sudo fuser -k 5000/tcp 2>/dev/null || true
pm2 delete ndfa-api 2>/dev/null || true
cd ~/NDMF/backend
pm2 start src/index.js --name ndfa-api
pm2 save
pm2 logs ndfa-api --lines 30
curl -s http://127.0.0.1:5000/api/v1/health
```

## 6) Admin build (fixes `/` HTTP 500)

HTTP 500 on `/` usually means `dist/` missing or nginx cannot read it.

```bash
cd ~/NDMF/admin-frontend
npm ci
npm run build
sudo mkdir -p /var/www/ndmf
sudo rsync -a --delete dist/ /var/www/ndmf/
sudo chown -R www-data:www-data /var/www/ndmf

sudo nginx -t
sudo systemctl reload nginx
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/
```

Expect `200` (not 500).

## 7) Browser

http://13.60.224.155/

Login: `9000000001` / `ndfa1234`

## Verify data in Postgres

```bash
psql "postgresql://ndfa:ndfa1234@127.0.0.1:5432/ndfa" -c \
  "SELECT collection, COUNT(*) FROM ndfa_docs GROUP BY collection ORDER BY 1;"
```
