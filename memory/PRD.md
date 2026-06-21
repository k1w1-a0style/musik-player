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

---

## Deep-Scan Arbeitsplan (PDF) – Umsetzung in Phasen

Quelle: `k1w1_musikplayer_arbeitsplan_deepscan.pdf`. 9 Phasen (0–8). User-Auswahl: **Start mit Phase 1**, eigener Fix-Branch (`fix/phase1-seek-scrubbing`), nur Development-Build, Abnahme via typecheck + lint:ci + jest.

### Phase 1 – Seek/Scrubbing-Performance ✓ (2026-06-21)
- `components/ProgressBar.tsx`: Tap-basierte Bar → echtes Drag-Scrubbing via PanResponder; lokaler `dragRatio`-State (optimistic UI), kein Rubber-Band durch 500ms-Polling; Live-Preview throttled (80ms); vergrößerter Thumb beim Ziehen. Pure Helpers exportiert (`clampRatio`, `resolveDragRatio`, `ratioToMillis`).
- `utils/seekController.ts` (neu): dedizierte Seek-Lane, coalesced rapid seeks (last value wins), nicht hinter Queue-Rebuilds/Metadata-Jobs serialisiert.
- `contexts/playbackControlHelpers.ts`: `seekToMillis` läuft über die Seek-Lane statt über `runExclusiveNativePlaybackControl`.
- `screens/NowPlayingPlaybackSection.tsx`: `onSeekPreview` verdrahtet.
- Tests: `utils/__tests__/seekController.test.ts` (last-value-wins, clamping, error-swallow), Scrub-Math-Tests in `ProgressBar.test.ts`. typecheck + lint:ci grün; 1658/1660 jest grün (2 vorbestehende androidApkInspector-Fails wegen fehlendem aapt/apksigner im Container).

### Phase 2 – Metadaten-Refresh stabilisieren ✓ (2026-06-21, abgeschlossen 2026-06-22)
- `utils/songMetadataRefresh.ts`: **Per-Track-Timeout** (Default 12s, Option `perTrackTimeoutMs`) isoliert langsame/defekte Dateien via `withTimeout`; ein voller 83-Track-Lauf wird `completed` statt Teilscan „67/83". Slow/broken file → `failed` + Grund. Neu: `errorDetails: {uri, reason}[]` (Fehlerliste).
- `utils/libraryOperationTimeouts.ts`: getrenntes `MANUAL_METADATA_REFRESH_SOFT_BUDGET_MS` (5min, kein hartes Truncating mehr) + `MANUAL_METADATA_REFRESH_PER_TRACK_TIMEOUT_MS`; Import-Flow-90s unverändert.
- `utils/metadataRefreshActivity.ts` (neu): globaler Aktiv-Flag + `useMetadataRefreshActive` (useSyncExternalStore). Manueller Refresh klammert mit begin/end; Cover- & AudioInfo-Backfill pausieren während des Refresh und laufen danach weiter.
- `useLibraryMetadataRefreshRunner.ts`: Merges propagieren `errorDetails`. `useLibraryMetadataRefreshActions.ts`: Soft-Budget als Default, loggt Per-Track-Fehlerliste.
- **Restplan abgearbeitet (2026-06-22)**:
  - `utils/metadataRefreshOperation.ts` (neu): persistenter Operation-State (operationId, status, total, resumeIndex, processedIndexes, counters, errorDetails, lastProcessedSongId, startedAt/updatedAt) via `useSyncExternalStore` – nicht mehr nur `useRef`. Statusmaschine `idle → running → cancelling → cancelled/resumable/partial → completed/failed`.
  - `useLibraryMetadataRefreshLifecycle.cancelRefresh()` und Action `cancelRefresh`/`resumeMetadataRefresh` durch Controller verdrahtet.
  - `LibraryImportStatus`: Abbrechen-Button sichtbar während `running`, Fortsetzen-Button bei `resumable/cancelled`, Live-Zähler (x/y · aktualisiert · übersprungen · fehlgeschlagen) + kompakte Fehlerliste mit „… und N weitere".
  - `LibraryMenuModal`: Eintrag wird dynamisch zu „Metadaten-Update fortsetzen", wenn `canResumeRefresh`.
  - Native Fast-Path: TS-Interface `SystemAudio.extractMetadataFast(uri)`, Kotlin-Implementierung in `SystemAudioModule.kt` (MediaMetadataRetriever für title/artist/album/albumArtist/year/track/disc/genre/composer/duration/bitrate/mime), Jest-Mock + `mergeFastMetadataIntoId3Tags` Helper. JS-ID3 bleibt Fallback pro Feld. Pending Android device validation.
- Tests: per-track Timeout + Fehlergrund (`songMetadataRefresh.test.ts`), Activity-Store (`metadataRefreshActivity.test.ts`), Operation-Store (`metadataRefreshOperation.test.ts`), Cancel/Resume/Counters/Fehlerliste-UI (`LibraryImportStatus.test.tsx`), Menü-Fortsetzen-Label (`LibraryMenuModal.test.tsx`), Cancel-Lifecycle (`useLibraryMetadataRefreshLifecycle.test.tsx`), Fast-Path/Merge/Fallback (`songMetadataRefreshFastPath.test.ts`). typecheck + lint:ci grün; 1707 jest pass (2 vorbestehende androidApkInspector env-Fails).
- 📱 **Pending**: Native `extractMetadataFast` braucht Development-APK für echte On-Device-Verifikation.

### Phase 3 – Bottom-Navigation entfernen ✓ (2026-06-21)
- Bottom-Tab-Navigator (`TabsShell`) entfernt → neuer schlanker `navigation/MainShell.tsx` rendert die Bibliothek direkt als Hauptscreen + MiniPlayer-Overlay. `RootNavigator` nutzt MainShell; `Equalizer` ist jetzt ein Stack-Screen (Header mit Zurück).
- Equalizer wandert ins 3-Punkte-Menü: neuer `openEqualizer` in `useLibraryNavigationActions`, komponiert in `useLibraryControllerActions` (schließt Menü + navigiert), durchgereicht bis `LibraryMenuModal` (neuer Eintrag „Equalizer"). Playlists bleiben als Library-Top-Tab (Leertext-Kopie korrigiert, kein Verweis mehr auf untere Bar).
- `MiniPlayer`-Offset von Tabbar-Inset entkoppelt: `bottom: insets.bottom + 12` statt `72 + insets.bottom`.
- Entfernt: `navigation/TabsShell.tsx` (+ Test), `APP_TAB_ROUTES`, `AppTabParamList`. Cover-/Playlists-Tab-Screens bleiben als Dateien (ungenutzt), Cover-Funktionen später integrieren.
- Tests: neuer `MainShell.test.tsx` (Library als Hauptscreen, MiniPlayer-Offset, Fehlergrenze), `openEqualizer`-Navigationstest, Menü-/Props-Builder-Tests erweitert. typecheck + lint:ci grün; 1665 jest pass (2 vorbestehende androidApkInspector env-Fails).

### Phase 4a – Bibliothek-Sortierung (3 Modi) + Persistenz ✓ (2026-06-21)
- `utils/librarySort.ts` (neu): 3 stabile, nicht-mutierende Sortiermodi — `alphabet` (Titel, dann Interpret), `trackNumber` (führende Zahl, fehlende zuletzt), `year` (aufsteigend, fehlende zuletzt). Plus `getNextLibrarySortMode`, Labels, Guard.
- `hooks/useLibrarySortMode.ts` (neu): State + AsyncStorage-Persistenz (`librarySortMode`-Key in `storage.ts` mit Validierung/Default) + `cycleSortMode`.
- `components/LibrarySortControl.tsx` (neu): Pille im Tracks/Favoriten-Header, zykliert Sortierung; Sortierung wird auf `songs` vor dem ViewModel angewandt (greift damit auch für die Wiedergabe-Reihenfolge).
- Verdrahtet durch Controller → `useLibraryComponentProps` → `buildLibraryTabContentProps` → `LibraryTabContent`.
- Tests: Sortlogik, Hook-Persistenz, Control, Storage-Round-Trip; Literale aktualisiert. typecheck + lint:ci grün; 1679 jest pass (2 vorbestehende env-Fails).
- **OFFEN (Phase 4b)**: 4 Ansichts-Modi (große/kleine Cover-Raster, Liste, Banner) + Persistenz der Albumansicht.

### Phase 4b – 4 Song-Ansichtsmodi + Persistenz ✓ (2026-06-21, 4b-Rest abgeschlossen 2026-06-22)
- `utils/libraryViewMode.ts` (neu): 4 Modi `list`/`gridLarge`/`gridSmall`/`banner` → Spaltenzahl (1/2/3/1) + SongCard-Variante (row/tile/tile/banner), Cycler, Labels, Guard.
- `hooks/useLibrarySongViewMode.ts` (neu): State + AsyncStorage-Persistenz (`librarySongViewMode`-Key in `storage.ts` mit Validierung/Default).
- `components/SongCard.tsx`: neue Varianten `row`/`tile`/`banner` (memo um `variant` erweitert). `LibraryTabContent` setzt `numColumns` + Relayout-`key` je Modus, `getItemLayout` nur für Liste.
- `components/LibrarySongViewControl.tsx` (neu): Pille im Tracks/Favoriten-Header. `songViewMode` durch die Renderer-Kette (`useLibraryControllerRenderers`→`useLibraryRenderers`→`useLibrarySongRenderer`) und Component-Props verdrahtet.
- **4b-Rest (2026-06-22)**: `albumViewMode` wird ebenfalls persistiert – `useLibraryScreenState` lädt asynchron via `storage.getAlbumViewMode()`, schreibt bei Änderung mit Hydration-Guard zurück. Validierung/Default (`grid`) und Storage-Round-Trip durch `storage.test.ts` und `Library.test.tsx` abgedeckt. typecheck + lint:ci grün; 1707 jest pass (2 vorbestehende env-Fails).

### Offene Phasen (Reihenfolge laut Plan)
- **P2 Phase 6**: Waveform (Datenmodell, Cache, SVG, native Peak-Extraktion als BG-Job).
- **P2 Phase 7**: TrackInfo erweitern (CBR/VBR, Cover-Dimensionen/Bytes).
- **P2 Phase 8**: Queue Drag & Drop (echte Playback-Reihenfolge).

### Phase 5 – Now-Playing Redesign ✓ (2026-06-22)
- `screens/NowPlayingSnapPager.tsx` (neu): vertikaler Snap-Pager (FlatList `pagingEnabled` + `snapToInterval`) mit Player- und Details-Page, Page-Indicator rechts und `onPageChange`-Callback.
- `screens/nowPlayingLayout.ts`: erweiterte Metriken (`snapPageHeight`, `detailPageListHeight`); Cover wächst auf ~`min(width-64, max(220, 0.42·height))`, da jede Snap-Page volle Höhe hat.
- `screens/NowPlaying.tsx`: refactored auf zwei Snap-Pages. Page 1 = Cover/Title/Progress/Controls/Volume. Page 2 = Warteschlange + Metadaten-Karte. Header + Backdrop bleiben statisch über beiden Pages.
- `utils/jsPaletteFallback.ts` (neu): deterministischer JS-Fallback (FNV-1a-Hash über `id|artist|album|title`, HSL mit kontrollierter S/L) für `dominant/vibrant/lightVibrant/darkVibrant/muted/lightMuted/darkMuted`. `mergeNativeAndFallbackPalette` mergt native Felder feldweise mit dem Fallback. `pickReadableForeground` wählt anhand der Rec.601-Luminanz `#FFFFFF` oder `#0A0B0C`.
- `screens/useNowPlayingPresentation.ts`: nutzt den merge-fähigen JS-Fallback und exportiert `accent`, `accentDark`, `accentMuted`, `foregroundOnAccent`, `hasNativePalette` (für Kontrast/Branding-Switches der Pages).
- Tests: `nowPlayingLayout.test.ts` (neue Metriken inkl. Snap-Höhe), `NowPlayingSnapPager.test.tsx` (Pages + Indicator + `onPageChange`), `jsPaletteFallback.test.ts` (Hash/Palette/Merge/Foreground), `useNowPlayingPresentation.test.tsx` (Fallback-Pfad + `hasNativePalette`).
- typecheck + lint:ci grün; 1724 jest pass (2 vorbestehende androidApkInspector env-Fails).
