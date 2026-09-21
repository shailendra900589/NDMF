# Route 53 — create A records NOW (you are on this page)

Your hosted zone `ndclients.co.in` currently has **only 2 records**: NS + SOA.  
That is why `nslookup` = No answer and certbot fails.

**Do not run certbot again until A records exist.**

---

## On the same Route 53 page

Button: **Create record** (orange, top right)

### Record 1 — root domain

| Field | Set this |
|-------|----------|
| Record name | *(leave blank)* |
| Record type | **A** |
| Value | **13.60.224.155** |
| TTL | 300 |
| Routing policy | Simple |

Click **Create records**

### Record 2 — www

Click **Create record** again

| Field | Set this |
|-------|----------|
| Record name | **www** |
| Record type | **A** |
| Value | **13.60.224.155** |
| TTL | 300 |

Click **Create records**

---

## Records list must look like this (4+ rows)

| Record name | Type | Value |
|-------------|------|--------|
| ndclients.co.in | NS | ns-*.awsdns-* |
| ndclients.co.in | SOA | … |
| **ndclients.co.in** | **A** | **13.60.224.155** |
| **www.ndclients.co.in** | **A** | **13.60.224.155** |

---

## Verify (wait 1–5 min)

```bash
nslookup ndclients.co.in 8.8.8.8
# Address: 13.60.224.155

nslookup www.ndclients.co.in 8.8.8.8
# Address: 13.60.224.155
```

## Only then — SSL

```bash
sudo certbot --nginx -d ndclients.co.in -d www.ndclients.co.in \
  --non-interactive --agree-tos -m admin@ndclients.co.in --redirect
```

Until then: **http://13.60.224.155/**
