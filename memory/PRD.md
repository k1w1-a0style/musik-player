# PRD: Musikplayer App (Expo / React Native)

## Original Problem Statement
> "Mache einen deep scan und prüfe alles kritisch"

User-Auswahl: 1e (kompletter Rundum-Check), 2c (alles direkt fixen), 3c (E2E-Tests inkl. Frontend).
Hinweis: E2E via `testing_agent_v3` nicht anwendbar (React-Native-Mobile, kein Web-Backend).
Validierung erfolgte durch: `tsc --noEmit`, `eslint v9`, `expo-doctor` (17/17 ✓), Metro-Bundle-Export (934 Module, 0 Errors).

## Architektur
- **Stack**: Expo SDK 54, RN 0.81, React 19, TS strict
- **Audio**: `expo-audio` (moderne API, expo-av abgelöst)
- **Navigation**: `@react-navigation/native` + Bottom-Tabs
- **State**: React Context (MusicProvider) mit Ref-stabilem `AudioPlayer`
- **Styling**: zentrales `theme.ts`, dunkles WCAG-konformes Farbset

## User Personas
- Nutzer der lokale MP3/Audio-Dateien auf Android abspielen, taggen und verwalten will.

## Core Requirements (static)
- Wiedergabe lokaler/remoter Audios mit Play/Pause/Skip/Seek
- Bibliothek mit Geräte-Import via MediaLibrary-Permission
- Playlists (Create/Delete)
- ID3-Tag-Editor (Title/Artist/Album)
- Equalizer-UI
- Cover-Grid
- Dark-Theme, Accessibility-Labels, Test-IDs auf allen interaktiven Elementen

## Deep-Scan-Funde (alle behoben, 2026-04-21)

### P0 (App war nicht lauffähig — behoben)
- [x] 8 fehlende Dependencies nachinstalliert, SDK-Versionen abgeglichen (`expo install --fix`)
- [x] Broken Imports (`../src/contexts/...`, `../src/types/Song`) korrigiert, fehlende `types/Song.ts` erstellt
- [x] `MusicContext` neu geschrieben (vollständige API: play/pause/next/previous/seek/stop, typisiert, Lazy-Init, Cleanup)
- [x] `createContext(null)` Runtime-Crashes eliminiert (strenger Null-Check in `useMusicContext`)
- [x] `App.tsx` (Platzhalter) ersetzt durch Navigation + Provider + Theme
- [x] React-Navigation + Dependencies installiert und konfiguriert

### P1 (Funktionale Bugs — behoben)
- [x] `new Audio.Sound()` Leak in NowPlaying → durch Context + `useRef` ersetzt
- [x] FlatList-Items ohne onPress → SongCard mit `onPress={playSong}` gekoppelt
- [x] `ProgressBar` DOM-API (`offsetWidth`) → `onLayout`-Measurement
- [x] `musicParser.ts` (btoa/jsmediatags native-inkompatibel) → native-safe Fallback-Parser
- [x] 9 tote/doppelte Root-Dateien entfernt (api.ts, database.ts, player.tsx, ...)
- [x] expo-av → expo-audio Migration (Config-Plugin eingetragen)

### P2 (Qualität — behoben)
- [x] WCAG-Verletzung (weiß auf #00FF00 = 1.37:1) → neues Theme mit `onPrimary: #0A0A0A` auf `#22C55E` (7.05:1 ✓)
- [x] `TextInput` mit `placeholderTextColor` versorgt
- [x] Light-Theme-Bleed (#f0f0f0) entfernt
- [x] `utils/eslintrc.json` (Broken JSON) + `utils/prettierrc.json` gelöscht
- [x] ESLint 9 Flat-Config migriert
- [x] Korrupte PNG-Assets (base64-JPEGs als .png) durch valide PNGs ersetzt
- [x] Duplicate expo-constants dedupliziert
- [x] package-lock.json entfernt (yarn.lock als Single Source of Truth)

## Validierung
| Check | Status |
|---|---|
| `tsc --noEmit` | ✓ pass |
| `eslint . --quiet` | ✓ pass |
| `npx expo-doctor` | ✓ 17/17 |
| `expo export --platform android` | ✓ 934 Module, 5.93 MB |

## Backlog / Offen
- **P1**: Echter DSP-Equalizer via `react-native-audio-api` (aktuell UI-Demo)
- **P1**: Persistenz von Playlists via `@react-native-async-storage/async-storage` (aktuell nur In-Memory)
- **P1**: Richtiger ID3-Parser via `react-native-music-library` o.ä. (aktuell nur Filename-Fallback)
- **P2**: Unit-Tests (Jest) für MusicContext + utils
- **P2**: iOS-Support (aktuell nur Android)
- **P2**: EAS Build ausführen und APK generieren

## Next Action Items
1. AsyncStorage-Persistenz für Playlists
2. Jest-Config + Tests
3. EAS Build triggern
