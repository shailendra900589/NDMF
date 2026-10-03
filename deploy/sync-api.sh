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
echo "==> Public homepage"
sudo mkdir -p /var/www/ndmf-public
sudo rsync -a --delete ~/NDMF/public-site/ /var/www/ndmf-public/
sudo chown -R www-data:www-data /var/www/ndmf-public
sudo python3 << 'PY'
from pathlib import Path
snippet = """
  # NDFA_PUBLIC_HOME
  location = / {
    root /var/www/ndmf-public;
    try_files /index.html =404;
  }
  location /brand/ {
    alias /var/www/ndmf-public/brand/;
    expires 7d;
  }
  location = /robots.txt {
    alias /var/www/ndmf-public/robots.txt;
  }
  location = /sitemap.xml {
    alias /var/www/ndmf-public/sitemap.xml;
  }
"""
root = Path("/etc/nginx/sites-enabled")
if root.exists():
    for path in root.iterdir():
        text = path.read_text(encoding="utf-8", errors="replace")
        if "NDFA_PUBLIC_HOME" in text or "location / {" not in text:
            continue
        updated = text.replace("location / {", snippet + "\n  location / {")
        path.write_text(updated, encoding="utf-8")
        print(f"inserted public home into {path}")
PY
sudo python3 << 'PY'
from pathlib import Path
root = Path("/etc/nginx/sites-enabled")
if root.exists():
    for path in root.iterdir():
        text = path.read_text(encoding="utf-8", errors="replace")
        updated = text.replace("client_max_body_size 120M", "client_max_body_size 220M")
        updated = updated.replace("proxy_read_timeout 300s", "proxy_read_timeout 600s")
        updated = updated.replace("proxy_send_timeout 300s", "proxy_send_timeout 600s")
        if updated != text:
            path.write_text(updated, encoding="utf-8")
            print(f"raised upload limit in {path}")
PY
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
