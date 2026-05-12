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
npm run typecheck
npm test -- --runInBand
npm run lint:ci
npx expo config --json | jq -r '.name, .scheme, .slug, .android.package, .newArchEnabled'
npx expo config --json | jq '.android.permissions, .ios.infoPlist.NSMicrophoneUsageDescription // empty'
```

Erwartete Werte:

```text
Kiwi
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

`android.permission.RECORD_AUDIO` darf nicht erscheinen.

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
- Tag Editor mit kleiner lokaler Datei testen
- Tag Editor mit `content://`/SAF-Datei prüfen: muss read-only bleiben
- Tag Editor mit sehr großer Datei prüfen: muss vor dem Schreiben blockieren
- Equalizer öffnen: Status darf geräteabhängig/experimentell anzeigen
- Visualizer prüfen: kein Mikrofon-Permission-Prompt

## Nach dem Build

Wenn der Preview-Build sauber läuft:

```bash
npx eas build:list --platform android --limit 5
```

Build-Link, Geräte, Android-Versionen und Smoke-Test-Ergebnis in `docs/release-checklist.md` abhaken oder im Release-PR dokumentieren.
