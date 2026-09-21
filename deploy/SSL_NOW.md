# SSL — fix Chrome "Not secure" for ndclients.co.in

DNS is OK now (A → 13.60.224.155). HTTP works. HTTPS missing = "Not secure".

## On EC2 — run this once

```bash
# 1) AWS Security Group: allow inbound TCP 443 from 0.0.0.0/0 (if not already)

# 2) Get Let's Encrypt cert + auto HTTPS redirect
sudo certbot --nginx -d ndclients.co.in -d www.ndclients.co.in \
  --non-interactive --agree-tos -m admin@ndclients.co.in --redirect

# 3) Check
curl -sI https://ndclients.co.in/ | head -n 5
curl -s https://ndclients.co.in/api/v1/health
```

Then open: **https://ndclients.co.in/**  
Padlock / Secure dikhega.

## If certbot says bind / connection error

Security Group → Inbound rules → Add:
| Type | Port | Source |
|------|------|--------|
| HTTPS | 443 | 0.0.0.0/0 |

Also:
```bash
sudo ufw allow 443/tcp
sudo nginx -t && sudo systemctl reload nginx
```

## Until SSL is done

http://ndclients.co.in/ works but Chrome shows "Not secure" — that is normal for HTTP.
