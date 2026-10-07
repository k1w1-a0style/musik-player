# musik-player

Android-first Musikplayer auf Basis von Expo/React Native.

- **Projektname:** `musik-player`
- **Expo slug:** `musik-player`
- **Android package:** `com.k1w1a0style.musikplayer`

## Features (aktueller Stand)

- Lokale Musikbibliothek via `expo-media-library` und SAF-Ordnerimport inklusive ID3-Auslese.
- Native AudioInfo-Ermittlung für lokale und SAF-Quellen beim Import sowie Backfill für bereits gespeicherte Titel.
- AlbumArtist-Erkennung, Album-Gruppierung und Tag-Editor-Unterstützung.
- Wiedergabe mit `react-native-track-player` (Lockscreen/Bluetooth/Background).
- Playlists, Cover-Ansichten, Tag-Editor, Equalizer-UI.
- Native Visualizer/FFT-Auswertung ist im Release-Pfad entfernt; Now Playing zeigt keine FFT-Daten an.

> Hinweis: Push-Notifications werden nicht mehr als separates Utility geführt.

## Tech-Stack

- Expo SDK 54, React Native 0.81, React 19, TypeScript
- `react-native-track-player` 4.1
- Jest + jest-expo, ESLint 10

## Setup

```bash
nvm use # Node-LTS-Linie aus .nvmrc (22)
npm ci --no-audit --no-fund
npm run start
```

## Dev-Start und Diagnose

- Metro für normale Entwicklungszyklen laufen lassen; `expo start --clear` nur bei einem tatsächlich beschädigten Cache verwenden. Ein kalter Dev-Start muss den Modulgraph neu transformieren und ist nicht mit der Startzeit eines Release-Builds gleichzusetzen.
- Die App protokolliert datensparsame `[StartupTiming]`-Ereignisse für Fonts, Storage, sichtbare Bibliothek, TrackPlayer-Setup, vollständige Musik-Hydration und Tag-Write-Recovery.
- Nicht initiale Screens werden erst beim Navigieren ausgewertet. Das reduziert frühe JavaScript-Auswertung, erzeugt auf Android/iOS aber keine garantierten separaten Download-Bundles.
- Native Änderungen unter `modules/expo-system-audio` werden erst nach einem neuen Development Build wirksam.

Details, Invarianten und Messanleitung: [`docs/architecture/startup-hydration.md`](docs/architecture/startup-hydration.md).

## Wichtige Checks

```bash
npm ci --no-audit --no-fund
npx expo-doctor
npm run typecheck
npm test -- --runInBand
npm run lint:ci
npx expo config --json
```

## Quality Gates (verpflichtend)

- `npm run lint:ci` — ESLint ohne Warnungen (`react-hooks/rules-of-hooks` + `react-hooks/exhaustive-deps` sind auf `error`).
- `npm run typecheck` — TypeScript-Check ohne Emit.
- `npm test -- --runInBand` — Test-Suite.
- `npm run test:coverage` — Coverage für `utils`, `hooks` und `contexts` inkl. Mindestschwellen.

## CI / GitHub Actions

- Pull Requests gegen `codex` und `main` laufen über unabhängige Security-, Quality- und Native-Jobs. `Required release checks` wird nur grün, wenn alle drei erfolgreich sind. Der Check muss zusätzlich in GitHub als Branch-Schutz aktiviert sein; eine Workflow-Datei allein blockiert keine direkten Pushes oder Merges.
- `main` bleibt der Haupt-/Release-Branch.
- EAS-/Release-Builds und der Supabase-Legacy-Workflow bleiben separate manuelle bzw. gezielte Workflows und werden nicht automatisch auf jeden PR ausgeführt.

V2-Umsetzung und verbleibende Freigabeprüfungen: [`docs/review/v2-implementation-2026-10-07.md`](docs/review/v2-implementation-2026-10-07.md).
Zeitlich befristete Tooling-Risiken: [`security/npm-audit-risk-2026-10-07.md`](security/npm-audit-risk-2026-10-07.md).

## Aktuelle Testlage

Die Testanzahl wird bewusst nicht hart im README gepflegt. Aktuell maßgeblich ist:

```bash
npm test -- --runInBand
```

## Konfigurationsentscheidungen

- `tsconfig.json` nutzt kein `ignoreDeprecations` mehr; TypeScript-Warnungen sollen nicht pauschal unterdrückt werden.
- Expo SDK 57 / React Native 0.86 verwenden die New Architecture. Der Audioplayer ist `@rntp/player@5.12.1`; bestehende App-Aufrufe laufen über die lokale Kompatibilitätsschicht in `modules/playback-backend`, ohne nativen RNTP-4-Player.
- Der versionsgebundene Postinstall-Patch ergänzt native Bereitschaft, echte Command-Bestätigungen und die Audio-Session-ID. Versions- oder Quellabweichungen stoppen die Installation.
- RNTP 5 ist laut mitgelieferter Lizenz kostenlos für private, persönliche Nutzung; andere Nutzung benötigt eine gesonderte Lizenz. Es wurde keine Lizenz gekauft.
- Migrationsnachweis und offene Geräteprüfungen: [`docs/review/auftrag-1-2026-10-07.md`](docs/review/auftrag-1-2026-10-07.md).

## Release-Hinweise

- Vor einem Release immer einen **echten Android-/EAS-Build** ausführen (nicht nur Expo Go).
- Playback benötigt **keinen Mikrofonzugriff**; `RECORD_AUDIO` wird in der App-Konfiguration nicht angefordert.
- Native Änderungen für AudioInfo und SAF-TagWriter benötigen einen neuen Development Build, bevor sie auf dem Gerät wirksam sind.
- Der Tag-Editor schreibt lokale MP3/MP4/M4A-Dateien über Backup, Temp-Datei und Byteprüfung.
- SAF/content MP3/M4A/MP4 Texttag- und Cover-Writes sind nur über die native SAF-Schreibroute mit persisted Write-Permission, Provider-Writable-Flags, unterstütztem ID3-/Atom-Layout und erfolgreicher Byte-Verifikation freigegeben.
- MediaLibrary-`content://` ohne SAF-Grant, source-lose Planner-URIs, alte Native-Builds und nicht unterstützte ID3-/MP4-Layouts bleiben bewusst blockiert.
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
