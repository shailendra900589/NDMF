#!/usr/bin/env bash
# Full production fix on EC2 — run: bash deploy/fix-all.sh
set -euo pipefail
cd ~/NDMF

echo "==> 1. Git pull"
git fetch origin
git reset --hard origin/main

echo "==> 2. Env (domain)"
cp -f deploy/ndclients.backend.env backend/.env
cp -f deploy/ndclients.admin.env admin-frontend/.env.production

echo "==> 3. Backend deps (npm install keeps lock in sync)"
cd ~/NDMF/backend
npm install --omit=dev

echo "==> 4. PostgreSQL check"
sudo -u postgres psql -c "SELECT 1" >/dev/null 2>&1 || {
  echo "PostgreSQL not ready — see deploy/POSTGRES_SETUP.md"
  exit 1
}
sudo -u postgres psql -c "GRANT ALL ON SCHEMA public TO ndfa;" 2>/dev/null || true

echo "==> 5. Seed"
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
sudo systemctl reload nginx

echo "==> 9. Firewall"
sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
echo "y" | sudo ufw enable || true

echo "==> 10. SSL (Let's Encrypt) for ndclients.co.in"
# Only runs if DNS A record already points here
if dig +short ndclients.co.in A | grep -q .; then
  sudo apt-get install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d ndclients.co.in -d www.ndclients.co.in \
    --non-interactive --agree-tos -m admin@ndclients.co.in --redirect \
    || echo "WARN: certbot failed — DNS may still be propagating. Site works on HTTP."
else
  echo "SKIP SSL: no A record for ndclients.co.in yet."
  echo "Add Route53 A → 13.60.224.155 then re-run:"
  echo "  sudo certbot --nginx -d ndclients.co.in -d www.ndclients.co.in --non-interactive --agree-tos -m admin@ndclients.co.in --redirect"
fi

echo ""
echo "DONE."
echo " HTTP:  http://13.60.224.155/"
echo " HTTPS: https://ndclients.co.in/  (if certbot OK)"
echo " Health: http://13.60.224.155/api/v1/health"
curl -sS http://127.0.0.1/api/v1/health || true
echo ""
pm2 status
