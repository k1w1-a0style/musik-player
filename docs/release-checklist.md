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
npm run typecheck
npm test -- --runInBand
npm run lint:ci
npx expo config --json | jq -r '.name, .scheme, .slug, .android.package, .newArchEnabled'
npx expo config --json | jq '.android.permissions, .ios.infoPlist.NSMicrophoneUsageDescription // empty'
```

- [ ] Typecheck grün
- [ ] Tests grün
- [ ] Lint grün
- [ ] Expo Config Werte stimmen

## Permissions

- [ ] `RECORD_AUDIO` ist nicht in Android Permissions
- [ ] `NSMicrophoneUsageDescription` ist nicht gesetzt
- [ ] Keine neuen Permissions hinzugefügt
- [ ] Android enthält `READ_MEDIA_AUDIO`
- [ ] Android enthält `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
- [ ] Android blockiert Foto-/Video-Media-Permissions (`READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_VISUAL_USER_SELECTED`)
- [ ] Generiertes `AndroidManifest.xml` enthält keine Foto-/Video-/Mikrofon-Permissions

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
- [ ] Tag Edit Smoke Test (Save/No-op/Error Zustände sichtbar)
- [ ] Tag Edit Size-Limit Smoke Test (zu große Dateien werden blockiert, bevor geschrieben wird)
- [ ] Cover Remove Smoke Test (`removeCover` funktioniert nur wenn verfügbar)
- [ ] content:// Block Smoke Test (Schreiben klar blockiert/read-only)
- [ ] MiniPlayer/NowPlaying Smoke Test (disabled states + Navigation)
- [ ] TrackInfo/TagEditor Smoke Test (fehlende Felder = „Nicht verfügbar“)
- [ ] Equalizer Smoke Test (Status geräteabhängig/experimentell, kein falsches Versprechen)
- [ ] Visualizer Smoke Test (kein Mikrofon-Prompt)

## Known limitations

- SAF/content:// Writes sind bewusst read-only; direkte SAF-Tag-Writes sind nicht implementiert
- Cover ersetzen nicht implementiert
- Visualizer/FFT release-safe deaktiviert/optional
- MP4/M4A Writes funktionieren nur für bekannte sichere Atom-Layouts
- Sehr große Dateien werden beim In-App-Tag-Schreiben blockiert
