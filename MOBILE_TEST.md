# Mobile app — login test (before deploy)

## 1. Backend (required)

```powershell
cd D:\Laravel\NDFA\backend
npm run dev
```

Health: http://localhost:5000/api/v1/health

## 2. API test (same as app)

```powershell
powershell -File D:\Laravel\NDFA\scripts\test-mobile-login.ps1
```

## 3. Run Flutter app

### Android Emulator

`mobile-app/lib/app/data/services/api_constants.dart`:

```dart
static const bool useProduction = false;
static const bool useEmulatorHost = true;  // 10.0.2.2 → PC localhost
static const bool useRemoteApi = true;
```

```powershell
cd D:\Laravel\NDFA\mobile-app
flutter pub get
flutter run
```

### Real Android phone (same WiFi as PC)

1. `ipconfig` → note IPv4 (e.g. `192.168.1.19`)
2. In `api_constants.dart`:

```dart
static const bool useEmulatorHost = false;
static const String deviceHost = '192.168.1.19';  // your PC IP
```

3. Allow Windows Firewall for port **5000** (Node backend).
4. `flutter run` with phone USB debugging on.

## 4. Login on app

| Field | Value |
|-------|--------|
| Role | **Field Officer** |
| Mobile | `9000000003` (Delhi) or `9000000005` (Mumbai) |
| Password | `ndfa1234` |

Tap **Fill Field Officer** on login screen, then **Login**.

**OTP:** mobile as above → OTP `123456`

## 5. After login check

- Dashboard shows **Delhi Main Branch** (for FO Delhi)
- Quick actions: Listing, Dialer, Customers (no Collections)
- Pull / wait ~45s — data syncs from backend

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Connection timeout | Backend running? Correct IP / emulator host? |
| Wrong password | `cd backend && npm run seed` |
| Web works, phone not | Firewall + `useEmulatorHost false` + PC IP |
