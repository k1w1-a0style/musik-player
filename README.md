# Musikplayer

Eine moderne Expo-React-Native-App (SDK 54) für Android — Musikbibliothek, Wiedergabe mit
Lockscreen-Steuerung, Playlists, ID3-Tag-Editor, EQ-Presets und Cover-Grid.

Designsystem **„Midnight Ember"**: tiefes Indigo/Schwarz mit warmen Amber-Akzenten,
Glass-Morphism, Bricolage-Grotesque-Typografie, Lucide-Icons und Reanimated-Mikroanimationen.

## Features

- **Bibliothek** – Geräte-Import via `expo-media-library` mit echter ID3v2-Tag-Auslese
  (Title/Artist/Album/Year/Genre + eingebettete Album-Art) — kein Native-Modul nötig.
- **Wiedergabe** – `react-native-track-player` v4 (Lockscreen-Controls, Notification,
  Bluetooth-Remote-Steuerung, Hintergrund-Audio, Play/Pause/Skip/Seek, Repeat/Shuffle,
  Volume).
- **Persistenz** – AsyncStorage hält Bibliothek, Playlists, aktueller Song, Volume,
  Repeat-/Shuffle-Modus, EQ-Preset und EQ-Bands über App-Restarts hinweg.
- **Playlists** – Erstellen, Löschen, Abspielen einer kompletten Playlist.
- **Equalizer** – 10-Band-UI mit Presets (Flat / Rock / Pop / Jazz / Bass+ / Vocal /
  Electronic) plus Custom. *Hinweis: ehrlich als UI-Preset markiert — echter DSP-EQ
  erfordert ein Native-Modul wie `react-native-audio-api`.*
- **ID3-Tag-Editor** – Titel/Künstler/Album bearbeiten; persistiert in der Bibliothek.
- **Cover** – 2-Spalten-Album-Grid; tippen spielt das Album.
- **Bottom-Tab-Navigation** mit Lucide-Icons.

## Stack

- Expo SDK 54 / React Native 0.81 / React 19 / TypeScript strict
- `react-native-track-player` 4.1 mit `PlaybackService` (Lockscreen + Bluetooth)
- `@react-native-async-storage/async-storage` (Persistenz)
- `expo-blur`, `expo-linear-gradient`, `react-native-reanimated`, `lucide-react-native`
- Bricolage Grotesque via `@expo-google-fonts/bricolage-grotesque`
- ESLint v9 (Flat-Config), Jest + jest-expo

## Setup

```bash
yarn install
yarn start            # Expo Dev-Server (QR-Code für Expo Go / Custom Dev Client)
yarn android          # Auf angeschlossenes Android-Device pushen
```

### Validierung

```bash
yarn typecheck        # tsc --noEmit
yarn lint:ci          # eslint . --quiet
yarn test             # jest (26 Tests / 4 Suites)
npx expo-doctor       # 17/17 Checks
```

## Projektstruktur

```
/app
├── App.tsx                         # SafeArea + Provider + Bottom-Tab-Navigation
├── index.js                        # registerRootComponent + PlaybackService-Bind
├── theme.ts                        # Designsystem ("Midnight Ember")
├── contexts/
│   ├── MusicContext.tsx            # Audio-State, Hydration, Persistenz
│   └── __tests__/MusicContext.test.tsx
├── components/
│   ├── AppBackground.tsx           # Linear-Gradient + farbige Orbs
│   ├── GlassCard.tsx               # BlurView + Glass-Gradient
│   ├── Controls.tsx                # Lucide-Icons + Reanimated Press-Animation
│   ├── ProgressBar.tsx             # Seek-Bar mit onLayout
│   ├── ModernControls.tsx          # Volume-Slider
│   ├── SongCard.tsx                # Listenitem mit Cover/Indicator
│   └── PlaylistCard.tsx
├── screens/
│   ├── Library.tsx                 # Geräte-Import + ID3-Enrichment
│   ├── NowPlaying.tsx              # Cover-Rotation, Glass-Card
│   ├── Playlists.tsx
│   ├── Equalizer.tsx               # 10-Band + Presets
│   ├── Id3TagEditor.tsx
│   └── Covers.tsx
├── services/PlaybackService.ts     # Remote-Events (Play/Pause/Next/Seek/...)
├── utils/
│   ├── id3Parser.ts                # ID3v2.3/v2.4 Reader (TIT2/TPE1/TALB/TYER/TCON/APIC)
│   ├── musicParser.ts              # Filename-Fallback + formatTime
│   ├── storage.ts                  # AsyncStorage-Wrapper + Keys
│   ├── config.ts                   # Zod-validierte Env-Vars
│   ├── pushNotifications.ts
│   └── __tests__/                  # Unit-Tests (id3, storage, musicParser)
├── types/Song.ts                   # Song / Playlist / EqPreset
├── __mocks__/                      # Jest-Mocks (RNTP, AsyncStorage)
├── jest.config.js
├── jest.setup.js
├── eslint.config.js
├── eas.json                        # EAS Build-Profile
├── app.json / app.config.js
└── README.md
```

## Tests

```bash
yarn test               # alle Suites
yarn test:silent        # CI-Modus (--runInBand)
```

Aktueller Stand:

- **4 Suites / 26 Tests** — alle grün
- Abdeckt: `MusicContext` (Hydration, Playback, EQ-Preset/Custom-Switch, Repeat-Cycle,
  Volume, Playlist-Persistenz), `id3Parser` (v2.3-Frames, UTF-8, TPE1/TPE2-Priorität,
  Truncate-Resilience), `musicParser` (parseFilename, formatTime), `storage`
  (Round-Trip, Prefix, Resilience).

## EAS-Build

EAS-Login & Initial-Setup (einmalig):

```bash
npm install -g eas-cli
eas login
eas project:init     # erzeugt eas-project.json mit projectId
```

### Preview-APK (zum direkten Installieren)

```bash
eas build -p android --profile preview
```

`eas.json`-Profil `preview`:

```json
{
  "android": { "buildType": "apk", "withoutCredentials": true }
}
```

→ Nach ca. 10–15 min steht eine **APK** zum Download bereit (Link kommt von EAS).
Direkt auf das Gerät kopieren, ausführen, fertig.

### Production-APK / AAB

```bash
eas build -p android --profile production
```

Standardmäßig auf `apk` konfiguriert; für Play-Store-Upload `"buildType": "app-bundle"`
in `eas.json` setzen.

### Custom Dev Client (für nativen DSP-EQ + Visualizer)

Das lokale Modul `expo-system-audio` (Equalizer, Visualizer, Palette-Extraction)
erfordert einen Custom Dev Client — Expo Go reicht nicht.

```bash
# Einmalig Custom Dev Client bauen:
eas build -p android --profile development

# Danach Dev-Server starten:
npx expo start --dev-client
```

### Lokale Voraussetzungen für die App selbst

- Bei der ersten Ausführung **Berechtigung** „Audio/Mediendateien lesen" zulassen,
  damit die Bibliothek importiert werden kann.
- Notifications-Berechtigung wird automatisch beim ersten Start erfragt
  (für Lockscreen-Controls).

## Bekannte Einschränkungen

- **Equalizer ist nur UI** — DSP-Filter erfordern ein Custom-Native-Modul
  (z.B. `react-native-audio-api`); im Managed-Workflow ohne EAS-Custom-Build nicht möglich.
- **Nur Android** — `app.json` definiert Android als einzige Plattform; iOS-Support
  ließe sich durch Hinzufügen von `"ios"` zu `platforms` und `ios.bundleIdentifier`
  einrichten.
- `react-native-track-player` v4 läuft auf der New Architecture im Interop-Modus.
  Bei Problemen kann `"newArchEnabled": false` in `app.json` gesetzt werden.

## Lizenz

MIT
