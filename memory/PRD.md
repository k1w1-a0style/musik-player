# PRD: Musikplayer App (Expo / React Native)

## Original Problem Statement
> Mein Umsetzungsplan:
> 1. AsyncStorage → Playlists, aktueller Song, EQ-Preset, Volume persistieren
> 2. Echter ID3-Parser → eigener leichtgewichtiger ID3v2-Reader (liest binary via expo-file-system), parsed Title/Artist/Album/Albumart — kein native Modul nötig
> 3. Lockscreen + Media Session → Migration zu react-native-track-player v4 (inkl. Config-Plugin; bringt Lockscreen-Controls, Notification, Queue, Shuffle/Repeat, Background-Audio)
> 4. Stylisches Premium-UI → Bricolage Grotesque Font, Glass-morphism via expo-blur, LinearGradient-Hintergründe, Lucide-Icons, Reanimated-Mikroanimationen, neues Farb-System (Midnight + Amber)
> 5. EQ: 10-Band-Presets (Flat/Rock/Pop/Jazz/Bass Boost/Custom) persistiert — echter DSP-EQ im Managed-Workflow ohne eigenes Native-Modul nicht machbar, markiere ehrlich als UI-Preset
> 6. Jest-Tests für MusicContext + ID3-Parser + utils
> 7. EAS Build Setup + Anleitung
>
> "Aber mitten drin wurde wir unterbrochen ... Kannst du das prüfen und beenden?"

User-Auswahl (2026-04-25): **A — alles wie geplant durchziehen**.

## Architektur
- **Stack**: Expo SDK 54, RN 0.81, React 19, TypeScript strict, ESLint v9 Flat-Config
- **Audio**: `react-native-track-player` 4.1 (Lockscreen, Notifications, BT-Remote, Queue)
- **Persistenz**: `@react-native-async-storage/async-storage` mit `@musikplayer:`-Prefix
- **ID3-Parsing**: eigener `utils/id3Parser.ts` (ID3v2.3 + v2.4, TIT2/TPE1/TPE2/TALB/TYER/TDRC/TCON/APIC, ISO-8859-1/UTF-8/UTF-16-Decoder, base64-encoded APIC als Data-URI)
- **Navigation**: `@react-navigation/native` + Bottom-Tabs
- **State**: React Context (`MusicProvider`) mit Hydration + Persistenz
- **Design**: zentrales `theme.ts` ("Midnight Ember"), Bricolage-Grotesque, Lucide-Icons, expo-blur, expo-linear-gradient, react-native-reanimated
- **Tests**: jest-expo, 4 Suites / 26 Tests, mocks für RNTP + AsyncStorage

## User Personas
- Nutzer der lokale MP3-Dateien auf Android abspielen, taggen und in Playlists organisieren will – mit Lockscreen-Controls und persistenten Einstellungen über App-Restarts hinweg.

## Core Requirements (static)
- Wiedergabe lokaler/remoter Audios mit Play/Pause/Skip/Seek (Lockscreen + Notification)
- Bibliothek mit Geräte-Import via MediaLibrary inkl. echter ID3-Tag- + Cover-Auslese
- Playlists (Create/Delete/Play) mit Persistenz
- ID3-Tag-Editor (Title/Artist/Album)
- Equalizer-UI (10-Band, 7 Presets, persistiert)
- Cover-Grid mit Album-Play
- Dark-Theme, Accessibility-Labels, Test-IDs auf allen interaktiven Elementen

## Iteration 2 (2026-04-25) — abgeschlossen
- [x] AsyncStorage-Persistenz für Songs, Playlists, currentSongId, Volume, Repeat, Shuffle, EQ-Bands/Preset/Enabled (`utils/storage.ts` + Hydrations-Effekt im `MusicContext`)
- [x] **Race-Condition-Bug entdeckt & gefixt**: Persistenz-Effekte feuerten beim Mount und überschrieben gespeicherte Werte (z.B. Volume) bevor die Hydration sie laden konnte → alle Persistenz-Effekte gaten jetzt auf `isReady`
- [x] Eigener ID3v2-Parser (`utils/id3Parser.ts`) — liest die ersten 1 MB via `FileSystem.readAsStringAsync({encoding:base64})` bzw. neuer `File`-API, dekodiert Frames mit ISO-8859-1 / UTF-8 / UTF-16-LE/BE, extrahiert Album-Art als `data:image/...;base64,...` URI
- [x] ID3-Parser in `Library.tsx` eingebunden (8 Worker parallel, sortiert nach Titel)
- [x] `react-native-track-player` v4 setup mit `PlaybackService` (Lockscreen, Bluetooth-Remote-Buttons, RemoteSeek/Jump)
- [x] Bricolage-Grotesque (4 Weights) via `@expo-google-fonts/bricolage-grotesque` in `App.tsx`
- [x] Glass-Morphism via `expo-blur` (`GlassCard`)
- [x] Linear-Gradient-Hintergründe + Amber/Indigo-Orbs (`AppBackground`)
- [x] Lucide-Icons in Tab-Bar, Controls, SongCard, Playlists, Equalizer, Covers, Id3-Form
- [x] Reanimated-Mikroanimationen: Press-Scale auf allen Buttons, Pulse-Animation auf Play-Button, Cover-Rotation in NowPlaying
- [x] Equalizer mit 7 Presets (Flat/Rock/Pop/Jazz/Bass+/Vocal/Electronic) + Custom-Auto-Detect, ehrlich als UI markiert
- [x] `Playlists.tsx` umgestellt auf Context (war vorher lokaler State!)
- [x] Jest-Setup mit jest-expo, RNTP- und AsyncStorage-Mocks, 4 Suites / 26 Tests grün
- [x] EAS-Build-Anleitung im README

## Validierung (2026-04-25)
| Check | Status |
|---|---|
| `tsc --noEmit` | ✓ 0 errors |
| `eslint . --quiet` | ✓ 0 errors / 0 warnings |
| `jest --runInBand` | ✓ 4 Suites / 26 Tests |
| `npx expo-doctor` | ✓ 17/17 |
| `expo export --platform android` (JSC) | ✓ 4.08 MB Bundle |

Hinweis: `expo export` mit Hermes scheitert lokal, weil das vorgebackene
`hermesc`-Binary mit der libc dieses Sandbox-Containers inkompatibel ist —
auf EAS Build Cloud läuft Hermes. Der Metro-Bundle-Schritt selbst (3153 Module)
wurde mit JSC erfolgreich validiert.

## Backlog / Offen
- **P1**: Echter DSP-Equalizer via Custom Native Module (`react-native-audio-api`)
- **P2**: iOS-Support (aktuell Android-only)
- **P2**: Search/Filter in Bibliothek
- **P2**: Drag-to-Reorder Playlist-Items
- **P3**: Sleep-Timer, Wake-Lock, Crossfade

## Next Action Items
1. EAS-Login + `eas project:init` ausführen, dann `eas build -p android --profile preview` zum APK
2. Bei Bedarf iOS aktivieren
3. Optional: DSP-EQ via Custom Native Module
