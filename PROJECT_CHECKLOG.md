# Project Checklog

## DeepScan-Status

Abgedeckte Review-Phasen aus den letzten DeepScan-PRs:

- [x] Storage-Races und Storage-Mutationen stabilisiert.
- [x] Cover/Base64/ID3-Parsing gehärtet.
- [x] FileSystem-/Tag-Write-Pfad mit Backup, Temp-Datei, Verification und Rollback-Grenzen abgesichert.
- [x] ErrorBoundary-, UX- und A11y-Schulden reduziert.
- [x] CoverCache-Hashing und Base64-Validierung stabilisiert.
- [x] SAF-Timeout-/Abort-Verhalten stabilisiert.
- [x] Storage-API-Typing und Scan-Folder-Merges dokumentiert/stabilisiert.
- [x] Import-Filter für sehr kurze Audiodateien konfigurierbar gemacht.
- [x] Config-TechDebt geprüft: `ignoreDeprecations` entfernt; `newArchEnabled=false` bleibt bewusst dokumentiert.
- [x] Playlist-Timestamp für gespeicherte Queue ergänzt.
- [x] `moveOrReplaceFile` Interface-Vertrag dokumentiert.

## Bewusst separate Themen

- i18n: keine Migration in dieser Review-Runde; betrifft UI-Texte breitflächig und braucht einen eigenen Plan.
- New Architecture: nicht aktivieren, solange `react-native-track-player@4.1.2` verwendet wird; vorher Playback-, Background-, Notification- und Android-Smoke-Tests durchführen.
- Vollständiger finaler Gesamttest: am 2026-06-11 auf dem aktuellen gemergten Stand erfolgreich ausgeführt; manuelle Android-Smokes und echte Release-/EAS-Builds bleiben separat.
- Langfristige Import-/Codec-Erweiterungen: nur separat erweitern, damit SAF-, MIME-, Duration- und Parser-Grenzen gezielt getestet werden können.

## Finale Validierung vor Release oder codex→main-Handoff

Automatisierte Gates (finaler Lauf am 2026-06-11 erfolgreich):

- [x] `npm run typecheck`
- [x] `npm run lint:ci`
- [x] `npm test -- --runInBand`
- [x] `npm run test:coverage`
- [x] `npx expo config --type public`
- [x] `npx jest --runInBand --testPathPattern=__tests__/expoReleaseConfigGate.test.ts`
- [x] `npx jest --runInBand --testPathPattern=__tests__/androidManifestPermissionGate.test.ts`
- [x] `npm run check:android-permissions`

Optionale/manuelle Android-Smokes nach Build oder SDK-/FileSystem-Änderungen:

- [ ] MediaLibrary-Import.
- [ ] SAF-Ordnerimport inklusive Timeout-/Abort-Verhalten.
- [ ] Playback im Vordergrund, Hintergrund, Lockscreen und Notification.
- [ ] Tag Edit/Cover Replace/Remove nur für unterstützte writable `file://` Tracks.
- [ ] `content://`/SAF bleibt read-only für Tag-/Cover-Writes.
- [ ] Cover cache cleanup inklusive Orphan-Enumeration.
