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

## Bewusst separate Themen

- i18n: keine Migration in dieser Review-Runde; betrifft UI-Texte breitflächig und braucht einen eigenen Plan.
- New Architecture: nicht aktivieren, solange `react-native-track-player@4.1.2` verwendet wird; vorher Playback-, Background-, Notification- und Android-Smoke-Tests durchführen.
- Vollständiger finaler Gesamttest: als separater Validierungsschritt auf dem letzten gemergten Stand ausführen.
- Langfristige Import-/Codec-Erweiterungen: nur separat erweitern, damit SAF-, MIME-, Duration- und Parser-Grenzen gezielt getestet werden können.

## Finale Validierung vor Release oder codex→main-Handoff

Automatisierte Gates:

- [ ] `npm run typecheck`
- [ ] `npm run lint:ci`
- [ ] `npm test -- --runInBand`
- [ ] `npx expo config --type public`
- [ ] `npm test -- --runInBand --testPathPatterns=__tests__/expoReleaseConfigGate.test.ts`
- [ ] `npm test -- --runInBand --testPathPatterns=__tests__/androidManifestPermissionGate.test.ts`

Optionale/manuelle Android-Smokes nach Build oder SDK-/FileSystem-Änderungen:

- [ ] MediaLibrary-Import.
- [ ] SAF-Ordnerimport inklusive Timeout-/Abort-Verhalten.
- [ ] Playback im Vordergrund, Hintergrund, Lockscreen und Notification.
- [ ] Tag Edit/Cover Replace/Remove nur für unterstützte writable `file://` Tracks.
- [ ] `content://`/SAF bleibt read-only für Tag-/Cover-Writes.
- [ ] Cover cache cleanup inklusive Orphan-Enumeration.
