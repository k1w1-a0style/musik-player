# Android Preview Build

Diese Anleitung ist der feste Pfad für einen ersten echten Android-Testbuild außerhalb von Expo Go.

## Ziel

- APK über EAS `preview` bauen
- native Module testen (`react-native-track-player`, `expo-system-audio`)
- finale Permissions prüfen
- Smoke Tests auf einem echten Android-Gerät durchführen

## Voraussetzungen

```bash
npm ci --no-audit --no-fund
npx eas whoami
```

Falls `eas whoami` fehlschlägt:

```bash
npx eas login
```

## Lokale Gates vor dem Build

```bash
npm run typecheck -- --pretty false
npm test -- --runInBand
npm run lint:ci
npx expo config --json | jq -r '.name, .scheme, .slug, .android.package, .newArchEnabled'
npx expo config --json | jq '.android.permissions, .android.blockedPermissions, .ios.infoPlist.NSMicrophoneUsageDescription // empty'
```

Erwartete Werte:

```text
k1w1-Musik
musik-player
musik-player
com.k1w1a0style.musikplayer
false
[
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.READ_MEDIA_AUDIO",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"
]
```

`android.permission.RECORD_AUDIO` darf nicht erscheinen; native FFT bleibt im Release-Modul deaktiviert. Android 13+ nutzt `READ_MEDIA_AUDIO`; ältere Android-Versionen werden über `expo-media-library`/Systemdialoge gelesen. `WRITE_EXTERNAL_STORAGE` wird nicht blind deklariert: lokale Tag-Updates laufen über app-writable lokale Dateien. SAF/content MP3/M4A/MP4 Texttag- und Cover-Writes laufen über die native SAF-Route mit persisted Write-Permission, Provider-Writable-Flags, unterstütztem ID3-/Atom-Layout und erfolgreicher Byte-Verifikation. MediaLibrary-`content://` ohne SAF-Grant, source-lose Planner-URIs, alte Native-Builds und nicht unterstützte Layouts bleiben blockiert.

## Generiertes Android Manifest prüfen

```bash
rm -rf android
npx expo prebuild --platform android --no-install --clean
npm run check:android-permissions
```

Der Check muss vor dem Preview-Build grün sein. Danach kann der lokal generierte `android/`-Ordner wieder gelöscht werden; er ist nur Prebuild-Output.

## Preview APK bauen

```bash
npx eas build --platform android --profile preview
```

Der `preview`-Build ist in `eas.json` als APK ohne Credentials konfiguriert und eignet sich für direkte Installation auf Testgeräten.

## Smoke Tests auf Gerät

- App installieren und starten
- Musik importieren
- SAF-Ordner auswählen und Scan prüfen
- Play/Pause/Next/Previous testen
- Background/Lockscreen/Notification testen
- Bluetooth/Headset Controls testen, wenn verfügbar
- Repeat/Shuffle setzen, App schließen, App neu öffnen und Zustand prüfen
- Import mit MP3 ID3v2.2/v2.3/v2.4 prüfen
- Embedded Cover prüfen
- Tag Editor mit kleiner lokaler Datei testen
- Tag Editor mit SAF-MP3-, SAF-M4A- und SAF-MP4-Dateien testen, jeweils mit persisted Write-Permission, Provider-Writable-Flags und sicher unterstütztem Layout
- SAF-Texttag- und Cover-Writes hinzufügen/ersetzen/entfernen prüfen; Datei muss danach abspielbar bleiben
- MediaLibrary-`content://`, source-lose Planner-URIs, fehlende SAF-Grants, alte Native-Builds und unsupported ID3-/MP4-Layouts müssen sichtbar blockiert bleiben
- No-op, Backup, Byte-Verifikation, Rollback und Restart-Recovery ohne Datenverlust-Anzeichen prüfen
- AlbumArtist-Anzeige, Gruppierung und Speichern prüfen
- AudioInfo-Backfill für bestehende Titel prüfen
- Tag Editor mit sehr großer Datei prüfen: muss vor dem Speichern blockieren
- Equalizer öffnen: Status darf geräteabhängig/experimentell anzeigen
- NowPlaying prüfen: kein Visualizer-Prompt und keine FFT-Anzeige

## Nach dem Build

Wenn der Preview-Build sauber läuft:

```bash
npx eas build:list --platform android --limit 5
```

Build-Link, Geräte, Android-Versionen und Smoke-Test-Ergebnis in `docs/release-checklist.md` abhaken oder im Release-PR dokumentieren.
