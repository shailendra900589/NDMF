# DNS + SSL for ndclients.co.in

## Current status

| Check | Result |
|-------|--------|
| API on IP | ✅ `http://13.60.224.155/api/v1/health` |
| Admin on IP | ✅ `http://13.60.224.155/` |
| PostgreSQL + seed | ✅ |
| pm2 `ndfa-api` | ✅ |
| Domain nameservers | ✅ Route53 (`*.awsdns-*.com`) |
| **A record** | ❌ **missing** — this blocks domain + SSL |
| www | ❌ NXDOMAIN |

Certbot failed earlier with: `no valid A records found for ndclients.co.in`.

## Fix in AWS Route 53 (required)

1. AWS Console → **Route 53** → **Hosted zones** → `ndclients.co.in`
2. **Create record**:
   - Record name: *(blank / `@`)*
   - Record type: **A**
   - Value: **`13.60.224.155`**
   - TTL: 300
3. **Create record** again for www:
   - Record name: **`www`**
   - Type: **A** (or CNAME → `ndclients.co.in`)
   - Value: **`13.60.224.155`**
4. Save. Wait 2–10 minutes.

### Verify

```bash
nslookup ndclients.co.in 8.8.8.8
# Address: 13.60.224.155

nslookup www.ndclients.co.in 8.8.8.8
```

Online: https://dnschecker.org/#A/ndclients.co.in

Registrar pe nameserver already AWS pe hona chahiye (already hai). Sirf **A record** add karna hai Route53 mein.

## After A record shows 13.60.224.155

On EC2:

```bash
cd ~/NDMF
git pull origin main
chmod +x deploy/fix-all.sh
bash deploy/fix-all.sh
```

Or SSL only:

```bash
sudo certbot --nginx -d ndclients.co.in -d www.ndclients.co.in \
  --non-interactive --agree-tos -m admin@ndclients.co.in --redirect
```

## Until DNS is ready — use IP

- Admin: http://13.60.224.155/
- API: http://13.60.224.155/api/v1/health
- Login: `9000000001` / `ndfa1234`

Chrome pe **https://** IP mat kholo — SSL IP pe nahi hai. Sirf **http://**.

## Security Group

Inbound: **22**, **80**, **443** from `0.0.0.0/0` (or your IP for 22).
