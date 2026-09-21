# GoDaddy fix — ndclients.co.in (IMPORTANT)

## Why domain still fails

Two different places exist:

| Place | What it shows now | Used by internet? |
|-------|-------------------|-------------------|
| **GoDaddy DNS page** (your screenshot) | A `@` = **Parked**, NS = domaincontrol.com | **NO** |
| **Public DNS** (Google 8.8.8.8) | NS = **AWS Route53** (`ns-*.awsdns-*`), **no A record** | **YES** |

Internet Route53 use kar raha hai. Isliye GoDaddy pe sirf A edit karne se **kuch nahi badlega**.

---

## FIX (easiest) — GoDaddy pe nameserver + A record

### Step 1 — Nameservers wapas GoDaddy

1. GoDaddy → **My Products** → **ndclients.co.in** → **DNS** / **Nameservers**
2. Click **Change** / **Manage nameservers**
3. Choose **GoDaddy nameservers** (default):
   - `ns01.domaincontrol.com`
   - `ns02.domaincontrol.com`
4. **Save** (propagation 5–30 min)

Direct link usually:  
https://dcc.godaddy.com/manage/ndclients.co.in/dns?tab=nameservers

### Step 2 — A record Parked → EC2 IP

Same DNS records page (your screenshot):

1. Find **Type A** | **Name `@`** | **Data Parked**
2. Click **Edit** (pencil)
3. Change value to: **`13.60.224.155`**
4. **Save**

`www` CNAME → `ndclients.co.in` **as-is chhod do** (already correct).

### Step 3 — Verify (wait a few minutes)

```bash
nslookup -type=NS ndclients.co.in 8.8.8.8
# must show: ns01.domaincontrol.com / ns02.domaincontrol.com

nslookup ndclients.co.in 8.8.8.8
# must show: Address: 13.60.224.155
```

Online: https://dnschecker.org/#A/ndclients.co.in

### Step 4 — SSL (only after Step 3 OK)

On EC2:

```bash
sudo certbot --nginx -d ndclients.co.in -d www.ndclients.co.in \
  --non-interactive --agree-tos -m admin@ndclients.co.in --redirect
```

Open: **https://ndclients.co.in/**

---

## Alternative (harder) — stay on Route53

Agar nameservers AWS pe hi rakhne hain:

1. AWS Console → Route 53 → Hosted zone `ndclients.co.in`
2. Create **A** `@` → `13.60.224.155`
3. Create **A** `www` → `13.60.224.155`

GoDaddy DNS page tab ignore hogi.

---

## Until DNS works

**http://13.60.224.155/** — already working  
Login: `9000000001` / `ndfa1234`
