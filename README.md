# School Admin

An offline-first, bilingual (English and Arabic) school administration app. It runs in the browser as an installable web app and can also be built as an Android app.

## Development

- `npm install` to install dependencies
- `npm run typecheck`, `npm run lint`, `npm test` to check the code
- `npm run build` to build the web app into `dist/`
- `npm run build:android` to build the web app and copy it into the Android project (requires the Android project to exist, see below)

## Build the APK

The Android app is built automatically by GitHub Actions. You do not need Android Studio.

1. Push your changes to the `main` branch on GitHub.
2. Open the **Actions** tab, pick the latest "Build Android APK" run, and download the `school-app-debug-apk` artifact. It contains `app-debug.apk`.
3. Or open the **Releases** page and download `app-debug.apk` from the `latest-debug` release, which is replaced on every build.
4. Copy the APK to your Android phone and open it. Allow installs from unknown sources when Android asks.

Notes:

- Debug builds are signed with a key that is created fresh on each GitHub build. If a new APK will not install over an older one, uninstall the old app first (this deletes data stored on that phone, so export a backup first).
- For APKs that install over each other, add the signing secrets described below. A signed release APK is then built on every push and is available as the `school-app-release-apk` artifact.

### Signing secrets (optional)

Add these in GitHub under Settings, Secrets and variables, Actions:

- `ANDROID_KEYSTORE_BASE64`: the keystore file encoded as base64
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Never commit the keystore file or its passwords to the repository.
