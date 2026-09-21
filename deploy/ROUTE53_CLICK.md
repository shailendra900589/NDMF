# STOP — Domain NXDOMAIN fix (do this in browser, NOT on EC2)

`bash deploy/fix-all.sh` **cannot** fix `DNS_PROBE_FINISHED_NXDOMAIN`.
Your EC2 has **no AWS credentials**, so the DNS script also cannot create records.

Server is already OK:
- Open now: **http://13.60.224.155/**  (login works)
- Domain fails until Route 53 has an **A record**

---

## Do this once (AWS Console — 2 minutes)

### 1. Open this URL
https://console.aws.amazon.com/route53/v2/hostedzones

### 2. Click hosted zone **`ndclients.co.in`**

(If zone missing: Create hosted zone → Domain name `ndclients.co.in` → Public → Create.
Then at your domain registrar set nameservers to the 4 `ns-*.awsdns-*` values shown.)

### 3. Create record #1 (root / apex)
Click **Create record**

| Field | Value |
|-------|--------|
| Record name | *(leave empty)* |
| Record type | **A** |
| Value | **13.60.224.155** |
| TTL | 300 |
| Routing | Simple |

→ **Create records**

### 4. Create record #2 (www)
Click **Create record** again

| Field | Value |
|-------|--------|
| Record name | **www** |
| Record type | **A** |
| Value | **13.60.224.155** |
| TTL | 300 |

→ **Create records**

You should now see in the records list:

```
ndclients.co.in     A   13.60.224.155
www.ndclients.co.in A   13.60.224.155
```

### 5. Wait 2–5 minutes, then verify on EC2

```bash
dig +short ndclients.co.in A @8.8.8.8
# MUST print: 13.60.224.155
```

If empty → A record still not created (wrong AWS account / wrong hosted zone).

### 6. Only AFTER dig shows the IP — run SSL

```bash
sudo certbot --nginx -d ndclients.co.in -d www.ndclients.co.in \
  --non-interactive --agree-tos -m admin@ndclients.co.in --redirect
```

Then open: **https://ndclients.co.in/**

---

## Do NOT keep doing this until dig works

```bash
bash deploy/fix-all.sh          # will NOT create DNS
bash deploy/create-dns-a-records.sh  # fails: no AWS credentials on EC2
```

Use IP until DNS is fixed: **http://13.60.224.155/**
