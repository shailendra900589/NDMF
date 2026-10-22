#!/usr/bin/env bash
# Update the existing host deployment without replacing environment files or database data.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ROOT="${ADMIN_WEB_ROOT:-/var/www/ndmf}"
SITE_URL="${SITE_URL:-https://ndclients.co.in}"
[[ "$WEB_ROOT" = /* && "$WEB_ROOT" != / ]] || { echo 'ADMIN_WEB_ROOT must be an absolute website directory'; exit 1; }
cd "$REPO_ROOT"

echo 'Installing backend dependencies'
(cd backend && npm ci --omit=dev)
echo 'Building the staff console'
(cd admin-frontend && npm ci && npm run build)

echo 'Updating the active Nginx console cache policy (including HTTPS)'
SITE_HOST=$(python3 -c 'import sys,urllib.parse; print(urllib.parse.urlparse(sys.argv[1]).hostname)' "$SITE_URL")
sudo python3 deploy/refresh-console-cache.py "$SITE_HOST" "$WEB_ROOT"

echo "Publishing the console to $WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
# Keep previous hashed assets for browsers that still have an older page open.
# Publish the entry document last, after every new asset is available.
sudo rsync -a --exclude=index.html admin-frontend/dist/ "$WEB_ROOT/"
sudo install -m 644 admin-frontend/dist/index.html "$WEB_ROOT/index.html.next"
sudo mv "$WEB_ROOT/index.html.next" "$WEB_ROOT/index.html"

echo 'Restarting the API'
pm2 restart ndfa-api
for attempt in {1..15}; do
  if curl -fsS --connect-timeout 3 --max-time 5 http://127.0.0.1:5000/api/v1/health >/dev/null; then break; fi
  if [[ "$attempt" = 15 ]]; then echo 'API did not become healthy; inspect pm2 logs ndfa-api'; exit 1; fi
  sleep 2
done

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
echo "Verified release $(git rev-parse --short HEAD): $SITE_URL/login"
echo 'Sign out, then sign in again. Super Admin opens /super-admin.'
pm2 status
