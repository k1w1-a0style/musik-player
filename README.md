# Musikplayer-App

Eine moderne Expo React Native (SDK 54) Musikplayer-App für Android.

## Features

- **Bibliothek**: Songs vom Gerät importieren (MediaLibrary) + Demo-Tracks
- **Wiedergabe**: Play/Pause/Next/Previous mit expo-audio, Seek-Bar mit echtem `onLayout`-Measurement, Hintergrundwiedergabe
- **Playlists**: Playlists erstellen/löschen
- **Equalizer**: 10-Band UI-Demo (echter DSP braucht Native-Modul)
- **ID3 Tags**: Titel/Künstler/Album bearbeiten
- **Cover**: Album-Grid mit Platzhalter-Artwork
- **Bottom-Tab-Navigation** (6 Screens)

## Stack

- Expo SDK 54 / React Native 0.81 / React 19
- expo-audio (modern), expo-media-library, expo-notifications
- @react-navigation/native + bottom-tabs
- TypeScript strict, ESLint 9 (Flat Config), Zod-Env-Validation

## Setup

```bash
yarn install
yarn start          # Expo Dev Server
yarn android        # Expo auf Android
yarn typecheck      # tsc --noEmit
yarn lint:ci        # eslint
```

## Projektstruktur

```
/app
├── App.tsx                       # Entry: SafeArea + MusicProvider + Navigation
├── index.js
├── theme.ts                      # Dark-Theme, WCAG-konform
├── contexts/MusicContext.tsx     # Audio-State + expo-audio Player
├── components/                   # Controls, ProgressBar, SongCard, ...
├── screens/                      # Library, NowPlaying, Playlists, Equalizer, Tags, Cover
├── types/Song.ts
├── utils/                        # musicParser (Filename-Fallback), config, pushNotifications
├── assets/                       # PNG-Icons
├── app.json                      # Expo Config inkl. expo-audio Plugin
└── eas.json                      # EAS APK Builds
```

## Build

APK via EAS:
```bash
eas build -p android --profile preview
```

## Lizenz

MIT
