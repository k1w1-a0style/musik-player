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
- [x] Config-TechDebt geprüft: `ignoreDeprecations` entfernt; New Architecture bleibt wegen `react-native-track-player@4.1.2` im Release-/Rollback-Pfad deaktiviert.
- [x] Playlist-Timestamp für gespeicherte Warteschlange ergänzt.
- [x] `moveOrReplaceFile` Interface-Vertrag dokumentiert.
- [x] A0 New-Architecture-Kompatibilitätsaudit angelegt; New Architecture bleibt deaktiviert und eine Aktivierung erfordert zuerst eine separate TrackPlayer-/Native-Kompatibilitätsentscheidung.
- [x] A1 TrackPlayer-Kompatibilitätsanalyse erstellt; keine Dependencies geändert, New Architecture bleibt deaktiviert, nächster möglicher Schritt wäre A2 nur nach Entscheidung.
- [x] A2 TrackPlayer-V4-Testabdeckung erweitert; keine Dependencies geändert, New Architecture bleibt deaktiviert, Android-Smokes für Background/Notification/Lockscreen bleiben manuell offen.
- [x] A3 Android Dev-APK Smoke-Report-Vorlage erstellt; kein Build / keine APK erstellt; echter Geräte-Smoke bleibt manuell offen.
- [x] DeepScan V2 P1 umgesetzt: Audio-Extensions zentralisiert, Palette-Timeout abgesichert, RNTP-Postinstall-Hinweis verbessert und production EAS auf den Store-Bundle-Pfad vorbereitet.
- [x] DeepScan V2 P2 Performance-/Import-Cleanup umgesetzt.
- [x] DeepScan V2 Backlog Audit durchgeführt: `ModernControls` war ausschließlich ein Lautstärke-Slider und wurde ohne UI-/Verhaltensänderung zu `VolumeSlider` umbenannt; `theme.fonts.mono` nutzt auf Android den System-Fallback `monospace`; der RNTP-`skip`-Cast wurde nach grünem Typecheck entfernt; `nativeQueueMutationLock` deckt Fehlerfolge und Test-Reset zusätzlich ab.
- [x] Bewusst dokumentierte DeepScan-V2-Restpunkte ohne Blind-Refactor: Cover-cache-directory-Recovery bleibt Edge-Case, weil `documentDirectory` im Expo-Zielpfad vorhanden ist und der bestehende Fallback nur optional greift; `assetBundlePatterns` bleibt bis APK-Inspect unverändert; MutationQueue-Konsolidierung bleibt Architekturthema; Version `1.0.0`/`AppVersionSource=remote` bleibt unverändert; `scheme` bleibt für Expo/Dev-Client ohne Deep-Link-System.
  - [x] Deferred bis separater Nachweis: Dev-Build/APK-Inspect für Asset-Bundling und echter Android-Smoke für Cover-cache-Recovery; in diesem Audit wurden dafür bewusst keine APK, keine Native-Änderung und kein Dependency-/SDK-Upgrade angestoßen.
- [x] Keine Dependency-, NewArch-, TrackPlayer- oder Native-Änderung vorgenommen; Dev-APK-Smoke bleibt weiterhin manuell offen.
- [x] DeepScan V4 P1 Micro-Fixes umgesetzt: albumPaletteHelpers Native-Promise-Semantik dokumentiert, progressUpdateEventInterval-Einheit präzisiert, configPermissions-Test auf alle blockedPermissions erweitert.
- [x] Keine Dependency-/NewArch-/TrackPlayer-/Native-Änderung.
- [x] Dev-APK-Smoke bleibt weiterhin offen.
- [x] DeepScan V4 P2 optional umgesetzt: `useAlbumPalette` bricht den JS-Timeout-Pfad bei Songwechsel/Unmount per `AbortController` ab.
- [x] `SystemAudio.extractPalette` bleibt non-cancellable; kein Native-Abort.
- [x] Keine Dependency-/NewArch-/TrackPlayer-/Native-Änderung.
- [x] Dev-APK-Smoke bleibt weiterhin offen.

## Finaler Dev-APK-Build-Ready-Check

Status: Letzter Build-Ready-Check vor separatem EAS Development Build.

- [x] Finaler Dev-APK-Build-Ready-Check durchgeführt.
- [x] Lokalen timezone-brittle Jest-Test für gespeicherte Warteschlangen-Namen stabilisiert.
- [x] Alle lokalen Quality Gates grün.
- [x] EAS/GitHub Development-Build-Workflow geprüft.
- [x] Keine Dependency-/NewArch-/TrackPlayer-/Native-Änderung.
- [x] Keine APK gebaut.
- [ ] Dev-APK-Smoke bleibt bis nach dem EAS Development Build offen.

## V6.6 Code-/Test-/Review-Fixes

Status: Code-/Test-/Review-Fixes sind abgeschlossen, sobald CI grün ist.

- [x] NowPlaying Favorite/Testmigration erledigt.
- [x] Cover-Picker Byte/MIME-Härtung erledigt.
- [x] TagEditor CoverControls A11y erledigt.
- [x] Controls/EQ/LibrarySearch Deutsch/A11y erledigt.
- [x] TagEditor/Modal/Warteschlange/EQ/ErrorBoundary A11y-Paket erledigt.
- [x] Deutsch-only Sweep für sichtbare UI- und Accessibility-Texte erledigt.
- [x] Keine i18n-Struktur eingeführt; App bleibt dauerhaft Deutsch-only.
- [x] Keine Builds/APKs erstellt.

## Bewusst separate Themen

- i18n: keine Migration; App ist dauerhaft Deutsch-only.
- New Architecture: bleibt auf `newArchEnabled=false`, solange `react-native-track-player@4.1.2` gepinnt ist. Eine spätere testweise Aktivierung braucht einen separaten Opt-in-PR oder das passende Dependency-Upgrade inklusive Android Dev-Build und Geräte-Smoke.
- Android Dev-APK Smoke: nach jeder künftigen New-Architecture-Aktivierung zwingend neu ausführen. Bei Build- oder Runtime-Problemen wird per separatem Fix-PR korrigiert oder New Architecture gezielt zurückgerollt.
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

Optionale/manuelle Android-Smokes nach Build, SDK-/FileSystem-Änderungen oder New-Architecture-Aktivierung:

- [ ] MediaLibrary-Import.
- [ ] SAF-Ordnerimport inklusive Timeout-/Abort-Verhalten.
- [ ] Playback im Vordergrund, Hintergrund, Lockscreen und Notification.
- [ ] Tag Edit/Cover Replace/Remove nur für unterstützte writable `file://` Titel.
- [ ] `content://`/SAF bleibt read-only für Tag-/Cover-Writes.
- [ ] Cover cache cleanup inklusive Orphan-Enumeration.

## Android-Smoke-Fix Cover-Backfill / Metadata Refresh (2026-06-16)

- [x] Android-Smoke-Fund behoben: Cover werden nach Import/Refresh automatisch im Hintergrund nachgeladen.
- [x] SongCard ist nicht mehr der einzige Cover-Ladepfad über Current-Song.
- [x] Metadata Refresh wurde für große Libraries entlastet.
- [x] Keine Dependency-/NewArch-/TrackPlayer-/Native-Änderung.
- [x] Keine APK gebaut.
- [ ] Echter Android-Smoke muss nach Merge erneut laufen.
