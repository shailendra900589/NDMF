#!/usr/bin/env bash
# Run on AWS as ubuntu:  bash deploy/setup-host.sh
set -euo pipefail
cd ~/NDMF

echo "==> Pull latest"
git pull origin main || true

echo "==> Env files"
cp -f deploy/ndclients.backend.env backend/.env
cp -f deploy/ndclients.admin.env admin-frontend/.env.production

echo "==> Install Node 20 if missing"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Backend deps + seed"
cd ~/NDMF/backend
npm install --omit=dev
npm run seed || true

echo "==> Start API with pm2"
sudo npm i -g pm2 >/dev/null 2>&1 || true
pm2 delete ndfa-api 2>/dev/null || true
pm2 start src/index.js --name ndfa-api
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -n 1 | bash || true

echo "==> Build admin"
cd ~/NDMF/admin-frontend
npm install
npm run build
sudo mkdir -p /var/www/ndmf
sudo rsync -a --delete dist/ /var/www/ndmf/
sudo chown -R www-data:www-data /var/www/ndmf

echo "==> Nginx"
sudo apt-get install -y nginx
sudo cp ~/NDMF/deploy/nginx-host.conf /etc/nginx/sites-available/ndmf
sudo ln -sf /etc/nginx/sites-available/ndmf /etc/nginx/sites-enabled/ndmf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "==> Firewall (ufw)"
sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
echo "y" | sudo ufw enable || true

echo ""
echo "DONE. Open:  http://13.60.224.155/"
echo "Health:      http://13.60.224.155/api/v1/health"
echo "NOTE: HTTP only until Route53 A record + certbot. See deploy/DNS_SSL.md"
pm2 status
curl -sS http://127.0.0.1/api/v1/health || true
echo ""
