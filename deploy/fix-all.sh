#!/usr/bin/env bash
# Full fix for ndclients.co.in — run on AWS:
#   cd ~/NDMF && bash deploy/fix-all.sh
set -euo pipefail
cd ~/NDMF

echo "==> 1. Git pull"
mv -f admin-frontend/.env.production /tmp/env.prod.bak 2>/dev/null || true
git fetch origin
git reset --hard origin/main

echo "==> 2. Env (domain)"
cp -f deploy/ndclients.backend.env backend/.env
cp -f deploy/ndclients.admin.env admin-frontend/.env.production

echo "==> 3. Install pg + deps (use npm install, not ci if lock was old)"
cd ~/NDMF/backend
npm install

echo "==> 4. PostgreSQL check"
if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y postgresql postgresql-contrib
  sudo systemctl enable --now postgresql
fi
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='ndfa'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ndfa WITH PASSWORD 'ndfa1234';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='ndfa'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ndfa OWNER ndfa;"
sudo -u postgres psql -d ndfa -c "GRANT ALL ON SCHEMA public TO ndfa;" || true

echo "==> 5. Seed"
cd ~/NDMF/backend
npm run seed

echo "==> 6. Free port 5000 + pm2"
sudo fuser -k 5000/tcp 2>/dev/null || true
pm2 delete ndfa-api 2>/dev/null || true
pm2 start src/index.js --name ndfa-api
pm2 save

echo "==> 7. Admin build → /var/www/ndmf"
cd ~/NDMF/admin-frontend
npm install
npm run build
sudo mkdir -p /var/www/ndmf
sudo rsync -a --delete dist/ /var/www/ndmf/
sudo chown -R www-data:www-data /var/www/ndmf

echo "==> 8. Nginx"
sudo apt-get install -y nginx
sudo cp ~/NDMF/deploy/nginx-host.conf /etc/nginx/sites-available/ndmf
sudo ln -sf /etc/nginx/sites-available/ndmf /etc/nginx/sites-enabled/ndmf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "==> 9. Firewall"
sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
echo "y" | sudo ufw enable || true

echo "==> 10. SSL (Let's Encrypt) for ndclients.co.in"
if ! command -v certbot >/dev/null 2>&1; then
  sudo apt-get install -y certbot python3-certbot-nginx
fi
sudo certbot --nginx -d ndclients.co.in -d www.ndclients.co.in --non-interactive --agree-tos -m admin@ndclients.co.in --redirect || \
  echo "WARN: certbot failed — DNS may still be propagating. Site works on HTTP."

echo ""
echo "DONE."
echo " HTTP:  http://ndclients.co.in/"
echo " HTTPS: https://ndclients.co.in/  (if certbot OK)"
echo " Health: http://ndclients.co.in/api/v1/health"
curl -sS http://127.0.0.1/api/v1/health || true
echo ""
pm2 status
