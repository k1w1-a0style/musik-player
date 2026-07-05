# Musik-Player (React Native / Expo) — PRD / Work Log

## Projekt
Lokaler Offline-Musikplayer (Expo SDK 54, RN 0.81, react-native-track-player 4.1.2, TypeScript). Deutsch-only UI. Kein Backend/MongoDB — reine Client-App mit AsyncStorage-Persistenz. Umfangreiche Jest-Testsuite (jest-expo).

## Aktuelle Aufgabe (2026-07-05): Deep-Scan Performance / Palette / Waveform / Runtime
Fortsetzung eines unterbrochenen Deep-Scan-Durchlaufs (Credits ausgegangen).

### Ausgangslage
- Vorheriger Commit `d7b3f62` hatte bereits erledigt: VirtualizedList/FlatList-Performance (`useLibrarySongRenderer`), Cover-Palette-Reset (`useAlbumPalette`), Hydration-Warnung-Kontextualisierung (`musicHydrationEmptyQueueLog`) — inkl. Tests.

### In diesem Lauf umgesetzt
- MP3/M4A Waveform-Nachvollziehbarkeit: neuer `utils/waveformDecision.ts` (Container- + Native-Entscheidungs-Klassifikation), `extractNativeWaveform` meldet Entscheidung via `onDecision`, `useSongWaveform` loggt nur in `__DEV__` verworfene Native-Pfade. Verhalten/Seeking unverändert.
- Tests: `utils/__tests__/waveformDecision.test.ts` + Erweiterung `waveformExtraction.test.ts`.
- npm Deprecated + New Architecture nur geprüft/dokumentiert (keine Dependency-/NewArch-Änderung).
- Report in `PROJECT_CHECKLOG.md`.

### Validierung
- typecheck grün, lint:ci grün. Ziel-Suiten grün (performance/library/palette/waveform/hydration/queue/metadata/trackInfo). Gesamt 1945 Tests grün.
- 2 rote Tests nur in `__tests__/androidApkInspector.test.ts` (fehlende `aapt`/`apksigner`-Binaries in dieser Umgebung — außerhalb Scope, vor diesem Lauf schon rot).

## Backlog / Nicht angefasst
- Kein EAS/Android/APK-Build; Android/Samsung/Huawei-Smoke offen.
- New Architecture bleibt deaktiviert (RNTP 4.1.2 gepinnt).
- androidApkInspector-Tests brauchen Android-Build-Tools (nur in CI/Android-Umgebung grün).
