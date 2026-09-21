# Fix ndclients.co.in DNS (NXDOMAIN / site can't be reached)

## What works now

| URL | Status |
|-----|--------|
| http://13.60.224.155/login | ✅ Admin login (HTTP = "Not secure" is normal) |
| http://13.60.224.155/api/v1/health | ✅ API OK |
| http://ndclients.co.in | ❌ **No A record** in Route 53 |

Chrome `DNS_PROBE_FINISHED_NXDOMAIN` = browser ko domain ka IP nahi milta.

Nameservers already AWS Route 53 pe hain (`ns-*.awsdns-*`). Zone empty hai — sirf **A record** add karna hai.

---

## FIX (pick one)

### Option 1 — AWS Console (2 minutes)

1. Open **AWS Console** → search **Route 53**
2. **Hosted zones** → click **`ndclients.co.in`**
3. **Create record**
   - Record name: leave **empty**
   - Record type: **A**
   - Value: **`13.60.224.155`**
   - TTL: **300**
   - Create
4. **Create record** again
   - Record name: **`www`**
   - Record type: **A**
   - Value: **`13.60.224.155`**
   - Create

### Option 2 — From EC2 terminal

```bash
cd ~/NDMF
git pull origin main
chmod +x deploy/create-dns-a-records.sh
bash deploy/create-dns-a-records.sh
```

Agar IAM role missing ho to script Option 1 batayega.

---

## Verify (laptop)

```powershell
nslookup ndclients.co.in 8.8.8.8
```

Must show: `Address: 13.60.224.155`

Online: https://dnschecker.org/#A/ndclients.co.in

---

## After DNS shows the IP — SSL + rebuild

On EC2:

```bash
cd ~/NDMF
git pull origin main
bash deploy/fix-all.sh
```

Or SSL only:

```bash
sudo certbot --nginx -d ndclients.co.in -d www.ndclients.co.in \
  --non-interactive --agree-tos -m admin@ndclients.co.in --redirect
```

Then open: **https://ndclients.co.in/**

---

## Until then

Use: **http://13.60.224.155/**  
Login: `9000000001` / `ndfa1234`  
Do **not** use `https://` on the raw IP.
