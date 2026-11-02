# VS Code / Cursor — red `lib/` folders

If the whole `mobile-app/lib` tree appears **red**, the Dart analyzer usually cannot find the **Flutter SDK** (not a code error).

1. Install Flutter 3.2+ and add `flutter\bin` to your system **PATH**.
2. In Cursor: **Command Palette → Dart: Change SDK** → select your Flutter install.
3. This repo already sets `"dart.flutterSdkPath": "C:\\Users\\uuu\\flutter"` in `.vscode/settings.json` (adjust if your SDK lives elsewhere).
4. Run in `mobile-app`: `flutter pub get`.

After the SDK is linked, folder colors should return to normal and `flutter analyze` should run clean.
