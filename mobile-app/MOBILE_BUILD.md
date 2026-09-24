# Nirmaldhara Field App — Android build

## Live API

App is configured for production:

`https://ndclients.co.in/api/v1`

(`mobile-app/lib/app/data/services/api_constants.dart` → `useProduction = true`)

Live sync: every **45s** + on app resume (listings, customers, attendance, pending uploads).

## Install APK

**Recommended (lightweight, most phones):**

`mobile-app/Nirmaldhara-FieldApp-v1.1.6-arm64.apk` (~21 MB)

Older 32-bit devices:

`mobile-app/Nirmaldhara-FieldApp-v1.1.6-armv7.apk` (~19 MB)

Gradle output:

`mobile-app/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk`

Phone pe install: transfer file → Allow unknown apps → Install.

## Login (Employee)

| Role | Mobile | Password |
|------|--------|----------|
| Employee Delhi | `9000000003` | `ndfa1234` |
| Employee Mumbai | `9000000005` | `ndfa1234` |
| OTP demo | any | `123456` |

## Rebuild

```powershell
$env:ANDROID_HOME = "C:\Users\uuu\Android\Sdk"
$env:Path = "C:\Users\uuu\flutter\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
cd D:\Laravel\NDFA\mobile-app
flutter pub get
flutter build apk --release --split-per-abi
copy build\app\outputs\flutter-apk\app-arm64-v8a-release.apk Nirmaldhara-FieldApp-v1.1.4-arm64.apk
```

`--split-per-abi` builds one APK per CPU (smaller than a single fat APK).

## Logo

- App UI: `assets/images/logo.png`
- Launcher icon: `android/app/src/main/res/mipmap-*/ic_launcher.png`
