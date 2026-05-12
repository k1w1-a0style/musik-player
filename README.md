# musik-player

Android-first Musikplayer auf Basis von Expo/React Native.

- **Projektname:** `musik-player`
- **Expo slug:** `musik-player`
- **Android package:** `com.k1w1a0style.musikplayer`

## Features (aktueller Stand)

- Lokale Musikbibliothek via `expo-media-library` inkl. ID3-Auslese.
- Wiedergabe mit `react-native-track-player` (Lockscreen/Bluetooth/Background).
- Playlists, Cover-Ansichten, Tag-Editor (einziger Schreibpfad), Equalizer-UI.
- Visualizer-UI läuft ohne Mikrofonzugriff; native FFT/Audio-Analyse ist release-sicher deaktiviert.

> Hinweis: Push-Notifications werden nicht mehr als separates Utility geführt.

## Tech-Stack

- Expo SDK 54, React Native 0.81, React 19, TypeScript
- `react-native-track-player` 4.1
- Jest + jest-expo, ESLint 9

## Setup

```bash
npm ci --no-audit --no-fund
npm run start
```

## Wichtige Checks

```bash
npm ci --no-audit --no-fund
npx expo-doctor
npm run typecheck
npm test -- --runInBand
npm run lint:ci
npx expo config --json
```

## Aktuelle Testlage

Die Testanzahl wird bewusst nicht hart im README gepflegt. Aktuell maßgeblich ist:

```bash
npm test -- --runInBand
```

## Release-Hinweise

- Vor einem Release immer einen **echten Android-/EAS-Build** ausführen (nicht nur Expo Go).
- Playback benötigt **keinen Mikrofonzugriff**; `RECORD_AUDIO` wird in der App-Konfiguration nicht angefordert.
- Der Tag-Editor schreibt nur lokale `file://` MP3/MP4/M4A-Dateien über Backup + Temp + Byteprüfung. `content://`/SAF bleibt read-only, bis ein echter SAF-Write-Flow vorhanden ist.
- Für große Audio-Dateien ist In-App-Tag-Schreiben begrenzt, um RAM- und Dateikorruptionsrisiken auf Android zu senken.

## Projektstruktur (vereinfacht)

```text
.
├── App.tsx                 # Einstieg, Provider, React Navigation
├── components/             # UI-Komponenten
├── contexts/               # App- und Music-State
├── screens/                # App-Screens
├── services/               # Playback-Service
├── utils/                  # Parser, Storage, Hilfsfunktionen
├── __mocks__/              # Jest-Mocks
├── app.json
├── app.config.js
├── eas.json
└── package.json
```
