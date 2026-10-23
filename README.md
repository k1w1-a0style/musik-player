# musik-player

Android-first Musikplayer auf Basis von Expo/React Native.

- **Projektname:** `musik-player`
- **Expo slug:** `musik-player`
- **Android package:** `com.k1w1a0style.musikplayer`

Aktueller Fortsetzungsstand vom 23.10.2026: [M3U/M3U8 und Abnahmegrenzen](docs/review/m3u-playlists-2026-10-23.md), [Security-Abgleich](docs/review/security-expiry-2026-10-23.md). Noch keine Gesamtfreigabe.

## Features (aktueller Stand)

- Lokale Musikbibliothek via `expo-media-library` und SAF-Ordnerimport inklusive ID3-Auslese.
- Scanphasen: Dateien suchen → Metadaten lesen → Bibliothek bestätigt speichern → optionale Waveforms. Die gespeicherte Bibliothek ist während der Analyse nutzbar; Ordner-Speicherfehler erscheinen als Teilerfolg mit gezieltem Retry.
- Native AudioInfo-Ermittlung für lokale und SAF-Quellen beim Import sowie Backfill für bereits gespeicherte Titel.
- AlbumArtist-Erkennung, Album-Gruppierung und Tag-Editor-Unterstützung.
- Wiedergabe mit dem gepatchten RNTP-V5-Adapter über `@rntp/player@5.12.1` (Lockscreen/Bluetooth/Background).
- Playlists mit M3U/M3U8-Dateiimport, kontrollierter lokaler Zuordnung und geprüftem M3U8-Export; Cover-Ansichten, Tag-Editor, Equalizer-UI.
- Native Visualizer/FFT-Auswertung ist im Release-Pfad entfernt; Now Playing zeigt keine FFT-Daten an.

> Hinweis: Push-Notifications werden nicht mehr als separates Utility geführt.

## Tech-Stack

- Expo 57.0.31, React Native 0.86.3, React 19.2.3, TypeScript 6; Node 22
- Lokale Kompatibilitätsschicht `modules/playback-backend` über `@rntp/player@5.12.1`, New Architecture aktiviert
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

Historischer V2-Bericht (07.10.2026; spätere Änderungen siehe [`docs/CODEX-V3-IMPLEMENTATION.md`](docs/CODEX-V3-IMPLEMENTATION.md)): [`docs/review/v2-implementation-2026-10-07.md`](docs/review/v2-implementation-2026-10-07.md).
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

## Projektfreigabe / letzter technischer Stand (22.10.2026)

Der neueste nachgewiesene Produktcode ist `63d5a61bad64af8af9be604e25dffbffb1298898`: 437 Jest-Suiten / 4.227 Tests, 182 Python-Regressionen und 215 native Tests bestanden. Die signierte Preview-APK ist als Testkandidat vorhanden, aber **nicht final freigegeben**.

- Das verpflichtende CI-Sicherheitsgate bleibt wegen der am 21.10.2026 abgelaufenen Ausnahmen für `braces@3.0.3` und `node-forge@1.4.0` rot: [Issue #396](https://github.com/k1w1-a0style/musik-player/issues/396). Beide Pakete sind auf diesem Stand in Tooling-Dependency-Pfaden noch installiert. Keine stillschweigende Fristverlängerung.
- Die neuste Audio-Leseberechtigungskorrektur hat Quality-, Manifest-, APK-Signatur- und Native-Gates bestanden. Installation und Android-UI-/Cover-Pause-/Back-Prüfung dieser **exakten** APK sind nicht nachgewiesen: [aktueller Nachweis](docs/review/audio-read-permission-fix-2026-10-22.md).
- Echte Samsung-/Huawei-, SAF-Provider-, Bluetooth-/Headset- und TalkBack-Abnahmen bleiben offen: [Gerätegate](docs/review/v4-real-device-gate.md).
- Interne Playlisten sind vorhanden; M3U-/M3U8-Dateiimport und -export sind noch nicht implementiert. Nicht mit nativen Playlisten verwechseln.
- Keine Übernahme alter V5-UI-Nachweise auf neue APK-Bytes, kein `codex` → `main`-Merge und keine Produktionsfreigabe ohne bestandene Gates.

## Release-Hinweise

- Vor einem Release immer einen **echten Android-/EAS-Build** ausführen (nicht nur Expo Go).
- Playback benötigt **keinen Mikrofonzugriff**; `RECORD_AUDIO` wird in der App-Konfiguration nicht angefordert.
- Native Änderungen für AudioInfo und SAF-TagWriter benötigen einen neuen Development Build, bevor sie auf dem Gerät wirksam sind.
- Lokale `file://`-Tagwrites bleiben gesperrt, bis ein dauerhaftes Recovery-Journal verfügbar ist. Lesen und Coverauswahl sind weiterhin möglich; Speichern erfordert eine bestätigte SAF-Quelle und den passenden nativen Writer.
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
