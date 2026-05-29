# Release Checklist

## Build Config

- [ ] `name` = `Kiwi`
- [ ] `scheme` = `musik-player`
- [ ] `slug` = `musik-player`
- [ ] Android package = `com.k1w1a0style.musikplayer`
- [ ] `newArchEnabled=false`
- [ ] `expo.extra.eas.projectId` ist vorhanden

## Lokale Gates

```bash
npm ci --no-audit --no-fund
npm run typecheck -- --pretty false
npm test -- --runInBand
npm run lint:ci
npx expo config --json | jq -r '.name, .scheme, .slug, .android.package, .newArchEnabled'
npx expo config --json | jq '.android.permissions, .android.blockedPermissions, .ios.infoPlist.NSMicrophoneUsageDescription // empty'
```

- [ ] Typecheck grün
- [ ] Tests grün
- [ ] Lint grün; `lint:ci` darf Warnungen nicht verstecken
- [ ] Expo Config Werte stimmen

## Permissions

- [ ] `RECORD_AUDIO` ist nicht in Android Permissions
- [ ] `NSMicrophoneUsageDescription` ist nicht gesetzt
- [ ] Keine neuen Permissions hinzugefügt
- [ ] Android enthält `READ_MEDIA_AUDIO`
- [ ] Android enthält `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
- [ ] Android blockiert Mikrofon-/Foto-/Video-Media-Permissions (`RECORD_AUDIO`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_VISUAL_USER_SELECTED`)
- [ ] Generiertes `AndroidManifest.xml` enthält keine Foto-/Video-/Mikrofon-Permissions

```bash
rm -rf android
npx expo prebuild --platform android --no-install --clean
npm run check:android-permissions
```

## Android Preview Build

Details: [`docs/android-preview-build.md`](./android-preview-build.md)

```bash
npx eas whoami
npx eas build --platform android --profile preview
```

- [ ] EAS Login geprüft
- [ ] Preview APK Build gestartet
- [ ] Build erfolgreich
- [ ] APK auf echtem Android-Gerät installiert
- [ ] Build-Link dokumentiert

## Smoke Tests

- [ ] App startet ohne Crash
- [ ] Playback Smoke Test (Play/Pause/Next/Prev, keine Regression)
- [ ] Background/Lockscreen/Notification Smoke Test
- [ ] Bluetooth/Headset Controls Smoke Test, wenn verfügbar
- [ ] Repeat/Shuffle Restore Smoke Test nach App-Neustart
- [ ] Import/SAF Smoke Test (Import läuft, SAF-Ordnerauswahl verständlich)
- [ ] ID3 Smoke Test mit MP3 v2.2/v2.3/v2.4 lesen; v2.2 Textfelder müssen beim Import sichtbar sein
- [ ] Cover Smoke Test (embedded Cover wird angezeigt; zu große/ungültige Cover bleiben stabil)
- [ ] Tag Edit Smoke Test (Save/No-op/Error Zustände sichtbar)
- [ ] Tag Edit Size-Limit Smoke Test (zu große Dateien werden blockiert, bevor geschrieben wird)
- [ ] Cover Remove Smoke Test (`removeCover` funktioniert nur für erkannte embedded/cached File-Cover, nicht für reine external CoverInfo)
- [ ] Cover Replace Smoke Test (unterstützter writable `file://` Track schreibt neues Cover; UI darf bis zum späteren Re-Scan zunächst die gewählte Cover-URI anzeigen)
- [ ] content:// Block Smoke Test (Schreiben klar blockiert/read-only)
- [ ] MiniPlayer/NowPlaying Smoke Test (disabled states + Navigation)
- [ ] TrackInfo/TagEditor Smoke Test (fehlende Felder = „Nicht verfügbar“)
- [ ] Equalizer Smoke Test (Status geräteabhängig/experimentell, kein falsches Versprechen)
- [ ] Visualizer Smoke Test (kein Mikrofon-Prompt; native FFT bleibt deaktivierter No-op)

## Known limitations

- SAF/content:// Writes sind bewusst read-only; direkte SAF-Tag-Writes sind nicht implementiert
- Cover ersetzen ist nur für unterstützte writable `file://` Tracks aktiv; unsupported Container bleiben blockiert
- MP4/M4A Cover-/Tag-Writes funktionieren nur für bekannte sichere Atom-Layouts
- Nach Cover Replace kann die UI zunächst die gewählte Cover-URI zeigen, bis ein späterer Re-Scan/extrahierter Cache eine stabilere eingebettete Cover-URI liefert
- Visualizer/FFT release-safe deaktiviert; native Android-Visualizer-API wird nicht verdrahtet
- Sehr große Dateien werden beim In-App-Tag-Schreiben blockiert
