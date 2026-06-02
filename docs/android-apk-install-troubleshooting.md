# Android APK install troubleshooting

This guide is for diagnosing a downloaded GitHub Actions APK when Android only shows a generic message such as `App wurde nicht installiert.` It is not a replacement for the workflow APK validation; it helps get the real device-side install error.


## Build the correct development APK

For a real development APK, always trigger the GitHub workflow with the `development` EAS profile on the `codex` ref:

```bash
gh workflow run eas-build.yml \
  --repo k1w1-a0style/musik-player \
  --ref codex \
  -f ref=codex \
  -f profile=development \
  -f platform=android \
  -f autofix=false \
  -f strict_lockfile=auto
```

After the workflow completes, install only the GitHub Actions artifact named `eas-android-development-<run_number>`. Do not manually install an arbitrary production or Play Store build from the Expo dashboard when testing the development APK.

On the Expo build page, the expected metadata for this target is:

- Profile: `development`
- Environment: `development`
- Android output: APK with Expo Dev Client
- Android package: `com.k1w1a0style.musikplayer.dev`
- App label: `k1w1-Musik`

It should not appear as an Android Play Store build, and it should not show `Environment: production`.

## 1. Download the APK from GitHub Actions

1. Open the `EAS Build` workflow run for the requested branch/profile.
2. Download the APK artifact named like `eas-android-development-<run_number>`.
3. Unzip the artifact if GitHub downloaded it as a `.zip`.
4. Confirm the APK file exists locally, for example:

```bash
ls -lh path/to/k1w1-development.apk
```

The workflow diagnostics artifact also contains `android-apk-inspection.log` with package, label, SDK, signature, ZIP, manifest, dex, ABI, and permission checks.

## 2. Install with adb to get the real error code

Use `adb install`; it prints the concrete Android package-manager error that the normal installer UI hides.

```bash
adb install -r path/to/k1w1-development.apk
```

If you may be installing an older versionCode than the one already on the device, retry with downgrade allowed:

```bash
adb install -r -d path/to/k1w1-development.apk
```

List existing related packages:

```bash
adb shell pm list packages | grep -Ei 'k1w1|musik|kiwi'
```

Uninstall both possible app IDs before a clean retry:

```bash
adb uninstall com.k1w1a0style.musikplayer
adb uninstall com.k1w1a0style.musikplayer.dev
adb install -r path/to/k1w1-development.apk
```

## 3. Common install errors and fixes

### `INSTALL_FAILED_UPDATE_INCOMPATIBLE`

A package with the same app ID is already installed but signed with a different certificate.

Fix:

```bash
adb uninstall com.k1w1a0style.musikplayer
adb uninstall com.k1w1a0style.musikplayer.dev
adb install -r path/to/k1w1-development.apk
```

### `INSTALL_FAILED_VERSION_DOWNGRADE`

The device has a newer `versionCode` for the same package.

Fix:

```bash
adb install -r -d path/to/k1w1-development.apk
```

If downgrade is not allowed by the device policy, uninstall the existing package first.

### `INSTALL_FAILED_NO_MATCHING_ABIS`

The APK does not contain native libraries for the device CPU ABI.

Fix:

- Check `nativeCode:` / `nativeLibAbis:` in `android-apk-inspection.log`.
- Use a universal APK or build an APK that includes the device ABI, usually `arm64-v8a` and/or `armeabi-v7a` for Android phones.

### `INSTALL_FAILED_INVALID_APK`

The file is damaged, incomplete, not a real APK, or structurally invalid.

Fix:

- Re-download the GitHub artifact.
- Verify `zipIntegrity: ok`, `hasAndroidManifestXml: yes`, and `hasClassesDex: yes` in `android-apk-inspection.log`.
- Confirm the APK size is plausible and not a tiny partial download.

### `INSTALL_PARSE_FAILED_NO_CERTIFICATES`

The APK is unsigned or the signature cannot be parsed.

Fix:

- Check `signatureStatus: verified` in `android-apk-inspection.log`.
- Rebuild the APK if signature verification failed.

### `INSTALL_FAILED_OLDER_SDK`

The device Android version is lower than the APK `minSdkVersion`.

Fix:

- Check `minSdkVersion:` in `android-apk-inspection.log`.
- Install on a device with a supported Android version or lower `minSdkVersion` only if the app dependencies support it.

### `INSTALL_FAILED_INSUFFICIENT_STORAGE`

The device does not have enough free space to install the APK.

Fix:

- Free storage on the device.
- Retry `adb install -r path/to/k1w1-development.apk`.

## 4. Report useful data

When reporting an install failure, include:

- The GitHub Actions run URL.
- The EAS Build URL.
- The APK artifact name.
- `android-apk-inspection.log`.
- The exact `adb install` command and output.
