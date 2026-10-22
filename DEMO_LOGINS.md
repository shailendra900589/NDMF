# NDFA — Login reference

**Site:** https://ndclients.co.in/  
**API:** https://ndclients.co.in/api/v1  
Demo accounts originally used `ndfa1234`. Production passwords can be changed; this is not a guarantee that every current account still uses it.

Live API verification on 22 October 2026:

| Login ID | Result |
|---|---|
| `ajitndfa@ndclients.co.in` | Super Admin login and company API verified with the supplied initial password |
| `9000000001` / `ADM001` | Account exists and is active; `ndfa1234` was rejected |
| `9000000002` / `BM001` | Account exists and is active; `ndfa1234` was rejected |
| `9000000003` | Employee login verified with `ndfa1234` |
| `9000000004` | Manager login verified with `ndfa1234` |
| `9000000005` | Employee login verified with `ndfa1234` |

Current passwords cannot be recovered from their bcrypt hashes. An authorised Super Admin can set a new password under Companies & Access → People. Verification did not reset any production passwords.

## Data visibility

| Role | Sees |
|------|------|
| **Admin** | All branches |
| **Branch Manager** | Own branch only (including employee updates) |
| **Employee** (Field Officer) | Own branch only |

Employee updates (listings, calls, attendance, tracking) save with their **branch** — so BM of that branch and Admin both see them.

## Accounts

| Role | Mobile (Login ID) | Where |
|------|-------------------|--------|
| Admin | `9000000001` | Web |
| Branch Manager — Delhi | `9000000002` | Web |
| Employee — Delhi | `9000000003` | Web + Mobile app |
| Branch Manager — Mumbai | `9000000004` | Web |
| Employee — Mumbai | `9000000005` | Web + Mobile app |

Demo OTP is disabled by default and cannot authenticate a Super Admin.
