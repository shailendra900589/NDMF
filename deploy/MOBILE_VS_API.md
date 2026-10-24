# Mobile and production update

Flutter runs on Android phones. The server serves a prebuilt APK; it does not need Flutter or the Android SDK.

On Ubuntu, from the existing repository checkout:

```bash
git pull --ff-only origin main
bash deploy/update-production.sh
```

The updater installs dependencies, builds the console, validates the APK checksum and architectures, publishes public-site (including downloads), preserves the active TLS/API configuration, restarts PM2 and verifies local/public API health and APK content type. A plain git pull updates source files only; run the updater to publish them.

Download: https://ndclients.co.in/downloads/mystaff-smart-1.3.0.apk
Production API: https://ndclients.co.in/api/v1
Use company-issued employee credentials. Production OTP demo authentication is disabled.
