# MyStaff Smart Android 1.3.0 (20)

Production API: https://ndclients.co.in/api/v1
Distribution artifact: public-site/downloads/mystaff-smart-1.3.0.apk (ARMv7 + ARM64, Android 7/API 24 or later).

Build from mobile-app:

```powershell
flutter pub get
flutter analyze --no-pub
flutter test --no-pub
flutter build apk --release --no-pub --target-platform android-arm,android-arm64
```

Output: build/app/outputs/flutter-apk/app-release.apk. Copy to the versioned public-site/downloads filename and regenerate release.json and the SHA256 sidecar before committing. The production updater validates the artifact and publishes it without building Flutter.

Feature headers no longer contain profile/logout duplicates; use Home → Profile for account/logout. Customer listings retain the main + action. Approved customers have a detail/verification view. The customer screen supports pull-to-refresh.

Refresh: GPS ping approximately every 15 seconds while duty service runs; data polling every 45 seconds and on resume. Offline and Android background restrictions can delay updates; this is polling rather than a WebSocket guarantee.

Existing signing identity is retained for update compatibility. This project currently uses its existing debug signing configuration for release builds; this is not a Play Store signing setup. Install over the prior app when signatures match. Never commit private signing keys.

Physical-device acceptance still required: camera and live face matching, GPS/background permission and battery handling, actual call/recording behavior and Android installation. Automated tests do not emulate these hardware features.
