#!/usr/bin/env bash
# Update the existing host deployment without replacing environment files or database data.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ROOT="${ADMIN_WEB_ROOT:-/var/www/ndmf}"
PUBLIC_ROOT="${PUBLIC_WEB_ROOT:-/var/www/ndmf-public}"
SITE_URL="${SITE_URL:-https://ndclients.co.in}"
[[ "$WEB_ROOT" = /* && "$WEB_ROOT" != / ]] || { echo 'ADMIN_WEB_ROOT must be an absolute website directory'; exit 1; }
cd "$REPO_ROOT"
node -e 'if (Number(process.versions.node.split(".")[0]) < 20) { console.error("Node.js 20 or newer is required"); process.exit(1); }'

echo 'Installing backend dependencies'
(cd backend && npm ci --omit=dev)
echo 'Building the staff console'
(cd admin-frontend && npm ci && npm run build)

echo 'Publishing public website and developer onboarding'
[[ "$PUBLIC_ROOT" = /* && "$PUBLIC_ROOT" != / ]] || { echo 'PUBLIC_WEB_ROOT must be an absolute website directory'; exit 1; }
sudo mkdir -p "$PUBLIC_ROOT"
sudo rsync -a --exclude=_preview_server.py --exclude=index.html public-site/ "$PUBLIC_ROOT/"
sudo install -m 644 public-site/index.html "$PUBLIC_ROOT/index.html.next"
sudo mv "$PUBLIC_ROOT/index.html.next" "$PUBLIC_ROOT/index.html"

echo 'Updating the active Nginx console cache policy (including HTTPS)'
SITE_HOST=$(python3 -c 'import sys,urllib.parse; print(urllib.parse.urlparse(sys.argv[1]).hostname)' "$SITE_URL")
sudo python3 deploy/refresh-console-cache.py "$SITE_HOST" "$WEB_ROOT" --public-root "$PUBLIC_ROOT"

echo 'Restarting the API'
pm2 restart ndfa-api
if ! python3 deploy/wait-for-api.py http://127.0.0.1:5000/api/v1/health; then
  pm2 status
  echo 'Inspect startup errors with: pm2 logs ndfa-api --nostream --lines 50'
  echo 'Also check PostgreSQL and the PORT / DATABASE_URL settings in backend/.env.'
  exit 1
fi
echo 'Verifying the API through the public HTTPS proxy'
if ! python3 deploy/wait-for-api.py "$SITE_URL/api/v1/health" --attempts 6; then
  echo 'Local API is healthy but public API verification failed. Check Nginx /api/ proxy and TLS.'
  exit 1
fi

echo "Publishing the console to $WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
# Keep old assets for open browser tabs; publish HTML after assets and API are ready.
sudo rsync -a --exclude=index.html admin-frontend/dist/ "$WEB_ROOT/"
sudo install -m 644 admin-frontend/dist/index.html "$WEB_ROOT/index.html.next"
sudo mv "$WEB_ROOT/index.html.next" "$WEB_ROOT/index.html"

echo 'Verifying the live console matches this build'
ENTRY=$(python3 -c 'import re,pathlib; print(re.search(r"src=\"(/assets/index-[^\"]+\.js)\"", pathlib.Path("admin-frontend/dist/index.html").read_text()).group(1))')
LIVE_HTML=$(curl -fsS --connect-timeout 10 --max-time 30 -H 'Cache-Control: no-cache' "$SITE_URL/login?deploy=$(git rev-parse --short HEAD)")
if ! grep -Fq "$ENTRY" <<< "$LIVE_HTML"; then
  echo 'ERROR: the live site is serving a different build. Check the active HTTPS Nginx root or set ADMIN_WEB_ROOT.'
  echo "Expected entry asset: $ENTRY"
  exit 1
fi
curl -fsS --connect-timeout 10 --max-time 30 "$SITE_URL$ENTRY" >/dev/null
for PAGE in login super-admin; do
  HEADERS=$(curl -fsSI --connect-timeout 10 --max-time 30 "$SITE_URL/$PAGE")
  if ! grep -Eiq '^cache-control:.*no-store' <<< "$HEADERS"; then
    echo "ERROR: /$PAGE is missing the HTML cache policy; check the active proxy/CDN configuration."
    exit 1
  fi
  PAGE_HTML=$(curl -fsS --connect-timeout 10 --max-time 30 "$SITE_URL/$PAGE")
  if ! grep -Fq "$ENTRY" <<< "$PAGE_HTML"; then
    echo "ERROR: /$PAGE is serving a different build."
    exit 1
  fi
done
echo 'Verifying the public homepage uses the new Smartstaff plus UI'
HOME_HTML=$(curl -fsS --connect-timeout 10 --max-time 30 -H 'Cache-Control: no-cache' "$SITE_URL/?release=$(git rev-parse --short HEAD)")
if ! grep -Fq 'data-public-release="smartstaff-ui-20261023"' <<< "$HOME_HTML"; then
  echo 'ERROR: public homepage is stale or points to the wrong root. Inspect nginx -T and PUBLIC_WEB_ROOT.'
  exit 1
fi
HOME_HEADERS=$(curl -fsSI --connect-timeout 10 --max-time 30 "$SITE_URL/")
if ! grep -Eiq '^cache-control:.*no-store' <<< "$HOME_HEADERS"; then
  echo 'ERROR: public homepage cache policy is missing; check the active proxy/CDN.'
  exit 1
fi
curl -fsS --connect-timeout 10 --max-time 30 "$SITE_URL/brand/site.js?v=2" >/dev/null
curl -fsS --connect-timeout 10 --max-time 30 "$SITE_URL/brand/styles.css?v=20261023-2" >/dev/null

echo 'Verifying developer documentation and onboarding API'
PORTAL_HTML=$(curl -fsS --connect-timeout 10 --max-time 30 "$SITE_URL/brand/developers.html?release=$(git rev-parse --short HEAD)")
grep -Fq 'id="onboarding"' <<< "$PORTAL_HTML"
CATALOG=$(curl -fsS --connect-timeout 10 --max-time 30 "$SITE_URL/api/v1/developer/catalog")
grep -Fq 'customers:read' <<< "$CATALOG"

echo "Verified release $(git rev-parse --short HEAD): $SITE_URL/login"
echo 'Sign out, then sign in again. Super Admin opens /super-admin.'
pm2 status
