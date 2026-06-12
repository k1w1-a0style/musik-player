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
- [x] Playlist-Timestamp für gespeicherte Warteschlange ergänzt.
- [x] `moveOrReplaceFile` Interface-Vertrag dokumentiert.

## V6.6 Code-/Test-/Review-Fixes

Status: Code-/Test-/Review-Fixes sind abgeschlossen, sobald CI grün ist.

- [x] NowPlaying Favorite/Testmigration erledigt.
- [x] Cover-Picker Byte/MIME-Härtung erledigt.
- [x] TagEditor CoverControls A11y erledigt.
- [x] Controls/EQ/LibrarySearch Deutsch/A11y erledigt.
- [x] TagEditor/Modal/Warteschlange/EQ/ErrorBoundary A11y-Paket erledigt.
- [x] Deutsch-only Sweep für sichtbare UI- und Accessibility-Texte erledigt.
- [x] Keine i18n-Struktur eingeführt; App bleibt dauerhaft Deutsch-only.
- [x] Keine New-Architecture-Arbeiten durchgeführt.
- [x] Keine Builds/APKs erstellt.

## Bewusst separate Themen

- i18n: keine Migration; App ist dauerhaft Deutsch-only.
- New Architecture: späterer separater Schritt und nicht Teil von V6.6. Nicht aktivieren, solange `react-native-track-player@4.1.2` verwendet wird; vorher Playback-, Background-, Notification- und Android-Smoke-Tests durchführen.
- V6.6 Android Dev-APK Smoke: offen/manuell; bleibt lokaler manueller Schritt nach Merge der V6.6-Fixes und ist nicht als smoke-final markiert.
- Vollständiger finaler Gesamttest: am 2026-06-12 im V6.6-Final-PR erfolgreich ausgeführt; manuelle Android-Smokes und echte Release-/EAS-Builds bleiben separat.
- Langfristige Import-/Codec-Erweiterungen: nur separat erweitern, damit SAF-, MIME-, Duration- und Parser-Grenzen gezielt getestet werden können.

## Finale Validierung vor Release oder codex→main-Handoff

Automatisierte Gates (finaler V6.6-Lauf am 2026-06-12 erfolgreich):

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
- [ ] Tag Edit/Cover Replace/Remove nur für unterstützte writable `file://` Titel.
- [ ] `content://`/SAF bleibt read-only für Tag-/Cover-Writes.
- [ ] Cover cache cleanup inklusive Orphan-Enumeration.
