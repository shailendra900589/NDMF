# NDFA — Live production logins

**Site:** https://ndclients.co.in/  
**API:** https://ndclients.co.in/api/v1  
**Password (all users):** `ndfa1234`

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

Mobile OTP demo: `123456`
