# musik-player

Android-first Musikplayer auf Basis von Expo/React Native.

- **Projektname:** `musik-player`
- **Expo slug:** `musik-player`
- **Android package:** `com.k1w1a0style.musikplayer`

## Features (aktueller Stand)

- Lokale Musikbibliothek via `expo-media-library` inkl. ID3-Auslese.
- Wiedergabe mit `react-native-track-player` (Lockscreen/Bluetooth/Background).
- Playlists, Cover-Ansichten, Tag-Editor (einziger Schreibpfad), Equalizer-UI.
- Visualizer/Audio-Integration über das native Modul **`expo-system-audio`**.

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

- **8 Test Suites**
- **41 Tests**

## Release-Hinweise

- Vor einem Release immer einen **echten Android-/EAS-Build** ausführen (nicht nur Expo Go).
- Die Android-Berechtigung **`RECORD_AUDIO`** wird für den Visualizer benötigt und muss in der Privacy-/Store-Kommunikation transparent erklärt werden.

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
