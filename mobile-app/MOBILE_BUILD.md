# Smartstaff plus — Android build

## Live API

App is configured for production:

`https://ndclients.co.in/api/v1`

(`mobile-app/lib/app/data/services/api_constants.dart` → `useProduction = true`)

Live sync: every **45s** + on app resume (listings, customers, attendance, pending uploads).

## Install APK

**Recommended (lightweight, most phones):**

`mobile-app/Smartstaff-plus-v1.2.1-arm64.apk` (~21 MB)

This release artifact targets ARM64 phones. For older 32-bit devices, build separately with `--target-platform android-arm --split-per-abi`.

Gradle output:

`mobile-app/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk`

Phone pe install: transfer file → Allow unknown apps → Install.

## Login and attendance

Use the employee ID/mobile and password issued for your company. Demo logins and demo OTP are not production credentials.

After deploying the backend, install/update the APK, sign in, and open Profile → Face enrollment. Existing valid registration is retained. If the server reports a saved-photo problem, retake three different reference photos and wait for server confirmation. Attendance still requires a matching live selfie and GPS when policy is enabled.

## Rebuild

```powershell
$env:ANDROID_HOME = "C:\Users\uuu\Android\Sdk"
$env:Path = "C:\Users\uuu\flutter\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
cd D:\Laravel\NDFA\mobile-app
flutter pub get
flutter build apk --release --split-per-abi
copy build\app\outputs\flutter-apk\app-arm64-v8a-release.apk Smartstaff-plus-v1.2.1-arm64.apk
```

`--split-per-abi` builds one APK per CPU (smaller than a single fat APK).

## Logo

- App UI: `assets/images/logo.png`
- Launcher icon: `android/app/src/main/res/mipmap-*/ic_launcher.png`
