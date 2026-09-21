#!/usr/bin/env bash
# Sync ONLY backend API + admin web on EC2.
# Does NOT deploy / build / copy mobile-app (Flutter stays on your phone/PC).
set -euo pipefail
cd ~/NDMF

echo "==> Git pull (API + admin only — mobile-app ignored on server)"
git fetch origin
git reset --hard origin/main

echo "==> Backend .env"
cp -f deploy/ndclients.backend.env backend/.env

echo "==> Backend deps + restart API"
cd ~/NDMF/backend
npm install --omit=dev
sudo fuser -k 5000/tcp 2>/dev/null || true
pm2 delete ndfa-api 2>/dev/null || true
pm2 start src/index.js --name ndfa-api
pm2 save

echo "==> Admin web build (optional UI)"
cp -f ~/NDMF/deploy/ndclients.admin.env ~/NDMF/admin-frontend/.env.production
cd ~/NDMF/admin-frontend
npm install
npm run build
sudo mkdir -p /var/www/ndmf
sudo rsync -a --delete dist/ /var/www/ndmf/
sudo chown -R www-data:www-data /var/www/ndmf
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "DONE — mobile-app was NOT deployed (correct)."
echo "API:  https://ndclients.co.in/api/v1/health"
curl -sS https://ndclients.co.in/api/v1/health || curl -sS http://127.0.0.1:5000/api/v1/health
echo ""
pm2 status
echo ""
echo "Mobile app: run locally on phone/PC → https://ndclients.co.in/api/v1"
echo "Login FO: 9000000003 / ndfa1234"
