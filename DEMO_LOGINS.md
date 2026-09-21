# NDFA — Live production logins

**Site:** https://ndclients.co.in/  
**API:** https://ndclients.co.in/api/v1  
**Password (all users):** `ndfa1234`  
**OTP (mobile demo):** `123456`

| Role | Mobile (Login ID) | Where |
|------|-------------------|--------|
| **Admin** | `9000000001` | Web admin |
| **Branch Manager — Delhi** | `9000000002` | Web admin |
| **Field Officer — Delhi** | `9000000003` | **Mobile app** |
| **Branch Manager — Mumbai** | `9000000004` | Web admin |
| **Field Officer — Mumbai** | `9000000005` | **Mobile app** |

## Mobile app

`api_constants.dart` → `useProduction = true`, `useProductionIp = false`  
→ base URL = `https://ndclients.co.in/api/v1`

Rebuild / hot-restart the app after pull:

```bash
cd mobile-app
flutter pub get
flutter run
```

Login as Field Officer: `9000000003` / `ndfa1234`
