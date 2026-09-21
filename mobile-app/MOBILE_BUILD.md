# Nirmaldhara Field App — Android build

## Live API

App is configured for production:

`https://ndclients.co.in/api/v1`

(`mobile-app/lib/app/data/services/api_constants.dart` → `useProduction = true`)

Live sync: every **45s** + on app resume (listings, customers, attendance, pending uploads).

## Install APK

Release APK (after build):

`mobile-app/Nirmaldhara-FieldApp-v1.1.0.apk`

or:

`mobile-app/build/app/outputs/flutter-apk/app-release.apk`

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
flutter build apk --release
```

## Logo

- App UI: `assets/images/logo.png`
- Launcher icon: `android/app/src/main/res/mipmap-*/ic_launcher.png`
