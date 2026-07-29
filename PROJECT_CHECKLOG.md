# Project Checklog

## Konsolidierte Deep-Scan-Härtung (2026-07-25)

- [x] Ausgangspunkt ist `codex` auf `496d0c713424ce9f21aa9f69f3a2b4b6c02e700e`; sämtliche Änderungen werden auf `fix/deep-scan-2026-07-25` integriert und erst nach vollständiger CI-/Review-Evidenz nach `codex` übernommen.
- [x] SAF-Imports verwenden pro Scan begrenzte Timeout-Zustände; ein doppelter Datei-Fallbackfehler wird strukturiert erfasst und beendet nicht mehr den gesamten Ordnerimport.
- [x] Library-Pruning behauptet nach einem fehlgeschlagenen nativen Queue-Reset keine falsche Synchronität; Queue und aktueller Song bleiben bis zur erfolgreichen Reconciliation konsistent.
- [x] Lautstärke-, Repeat-, Hydration- und Preference-Writes sind gegen Out-of-order-Completion, Doppeltipps und verspätete Storage-Reads abgesichert.
- [x] UI-Playback-Promises laufen über eine gemeinsame Fehlergrenze; Native-Rejections werden nicht mehr unhandled verworfen.
- [x] Der Equalizer wird ausschließlich an eine bestätigte TrackPlayer-Audio-Session gebunden, serialisiert initialisiert und bei Stale-Init/Unmount zuverlässig freigegeben; der globale Output-Mix wird nicht mehr verwendet.
- [x] SAF-Tag-Writes sind fail-closed, verwenden ein persistiertes endliches Recovery-Budget und können die harte 50-MiB-Sicherheitsgrenze weder in JavaScript noch nativ per Runtime-Option erweitern.
- [x] Waveform-Aufträge besitzen Request-IDs und echte native Cancel-Checks; verwaiste Calls bleiben zusätzlich durch den bestehenden Scheduler begrenzt.
- [x] Sleep-Timer-Deadline und Aktion werden persistiert und beim Playback-Service-Start generation-sicher rekonstruiert, ohne die Registrierung der Remote-Handler zu blockieren.
- [x] Queue-Reorder unterstützt Rand-Autoscroll mit scrolloffset-korrektem Zielindex; ein schneller zweiter manueller Metadaten-Refresh startet keine unnötige Native-I/O-Runde.
- [x] Zwölf nicht erreichbare Legacy-App-Dateien samt verwaisten Tests wurden entfernt; NUL-Bytes im Kotlin-Quelltext sind beseitigt.
- [x] ID3-Parser, ID3-Writer und Tag-Write-Plan wurden in kleinere, prüfbare Schritte zerlegt; der Parser lieferte in 437 generierten gültigen und beschädigten ID3v2.2/2.3/2.4-Fällen keine Abweichung zum Ausgangsverhalten.
- [x] CI enthält Per-File-Coverage, Komplexitäts-/Funktionslängen-Gates, eine explizite Android-Permission-Allowlist, einen Release-APK-/API-35-Emulator-Smoke sowie einen blockierenden npm-Audit-Check für neue High-/Critical-Funde.
- [x] Der frühere `shell-quote@1.8.3`-Critical-Blocker wird durch die inzwischen veröffentlichte Version `1.10.0` ersetzt; die temporäre Audit-Ausnahme wurde entfernt.
- [ ] Vollständige GitHub-CI, Release-APK-/Emulator-Smoke und abschließender Codex-PR-Review auf dem finalen Fix-Head stehen vor dem Integrations-Merge noch aus.
- [ ] Ein echter Samsung-/Huawei-Geräte-Smoke mit realen SAF-Providern bleibt trotz Emulator-/APK-Gate zwingendes Release-Kriterium.

## Waveform-Lifecycle P2-Härtung (2026-07-24)

- [x] Ausgangspunkt war `813449d41cc590ef38c26028b0ce628c9a443161`; die Umsetzung liegt in PR #320 auf `pxmg1j-codex/harte-den-waveform-lifecycle` gegen `codex` und wird nicht als direkter `codex`-Commit ausgegeben.
- [x] Befund vor dem Fix: `extractWaveformPeaks()` wurde bereits gestartet an `withTimeout()` übergeben; dessen internes `AbortSignal` erreichte den Extraktionspfad nicht. Der Hook-`active`-Schalter blockierte nur veraltete State-/Cache-Updates. Erfolgreiche Native-Ergebnisse wurden bereits gecacht, während leere, unbrauchbare oder fehlgeschlagene Versuche bei einem späteren Besuch erneut starten konnten. Unit-Tests für `waveformExtraction` und `withTimeout` existierten, aber kein Lifecycle-Test der echten Hook-Implementierung.
- [x] Gewählte Strategie: ehrliche JS-seitige Latest-only-Lastbegrenzung statt vorgetäuschter Native-Cancellation. Ein Effect-eigener `AbortController` beendet den JS-Wartepfad bei Songwechsel/Unmount sofort. `withTimeout` erhält die cancellable Operation-Form und ihr Signal steuert Debounce, wartende Requests und Subscriber.
- [x] Jeder Native-Start behält seine vollständige 120-ms-Debounce-Frist, auch wenn ein vorheriger Flight vor Ablauf dieser Frist endet. Superseded wartende Requests starten nicht nachträglich.
- [x] Single-Flight gilt pro `sourceKey`; regulär existiert genau ein aktiver getrackter Native-Flight und genau ein neuester wartender anderer Song.
- [x] Die Kotlin-Arbeit selbst wird **nicht** hart abgebrochen: Der vorhandene Expo-Vertrag bietet keine Request-ID/Cancel-Funktion. Wenn der letzte JS-Waiter durch Timeout, Songwechsel oder Unmount abbricht, wird der rohe Native-Flight als verwaist abgetrennt, damit der neueste relevante Song nach seiner Debounce-Frist weiterarbeiten kann.
- [x] Verwaiste Native-Flights sind auf zwei begrenzt. Nach zwei nicht settlenden Calls öffnet ein Fail-fast-Circuit: weitere Native-Starts werden ohne neue Acht-Sekunden-Timeout-Kette abgelehnt, bis mindestens ein verwaister Flight tatsächlich settlet. Damit entstehen weder globaler Scheduler-Deadlock noch unbegrenzte Native-Parallelität.
- [x] Der Test-Reset verwendet eine Lifecycle-Generation; Finalizer aus älteren Tests dürfen keine Requests einer neuen Testgeneration vorzeitig starten.
- [x] Native Last ist weiterhin intrinsisch begrenzt: `readSampleEnvelope` liest höchstens 2.400 komprimierte Samples über `MediaExtractor`; es findet keine vollständige PCM-Dekodierung statt. `MediaExtractor` und der nur bei Bedarf genutzte `MediaMetadataRetriever` werden in `finally` freigegeben.
- [x] Leere Ergebnisse, unbrauchbare Shapes, Native-Fehler und Timeouts erhalten einen benannten 30-s-In-Memory-Backoff je `sourceKey`; die Map ist auf 80 Einträge begrenzt und die ältesten Einträge werden nachweislich entfernt. Erfolgreiche Versuche löschen den Eintrag, Ablauf erlaubt einen Retry, erwartete Aborts erzeugen weder Backoff noch `native-error`-Telemetrie.
- [x] Echte Hook-Regressionstests decken Songwechsel, stale State/Cache, Unmount, Timeout, Single-Flight, Latest-only-Superseding, vollständige Debounce-Frist nach frühem Settlement, Weiterlauf nach einem nie settlenden Flight, bounded Circuit, Reset-Isolation, Backoff-Grenze/Ablauf und erfolgreichen Cache-Revisit mit stabilen Props, Deferred Promises und Fake Timers ab.
- [x] `utils/sha256.ts` war repositoryweit ohne Import/produktiven Aufrufer und wurde gelöscht. Native SHA-256-Transaktionsintegrität ist davon unabhängig; Cross-Format-Duplikaterkennung/F17 bleibt außerhalb des Scopes.
- [x] GitHub Actions #1062 auf Head `aaabb7515a5393bb73c1eb50dd5fa54f118df8f7`: Typecheck, 268 Jest-Suites / 2.260 Tests, Lint, Expo-/Manifest-Gates, Kotlin-Compile und 64 native Tests vollständig grün; Gradle `BUILD SUCCESSFUL`.
- [x] Keine APK, kein AAB, kein EAS-Build und kein Android-`assemble`/`bundle` ausgeführt; Issues #314, #318 und #319 bleiben getrennte Follow-ups.

## Theme Migration Paket 4 — Rest-Sweep + Guards (2026-07-10)

- [x] Code-seitiger Rest-Sweep für migrierte UI-Bereiche abgeschlossen: verbleibende `../theme`-Imports in Components/Screens wurden auf `APP_THEME_TOKENS` für statische Spacing-/Radii-/Font-Tokens umgestellt; dynamische Farben bleiben über `useAppTheme`/`AppTheme` aufgelöst.
- [x] Bewusst zulässige statische Tokens bleiben zentral in `APP_THEME_TOKENS`: Spacing, Radii/Border-Radius-Aliase, Fonts inklusive Mono-Fallback und Typografie. Diese Tokens sind nicht skin-/appearance-dynamisch und dürfen in `StyleSheet.create` verwendet werden.
- [x] Bewusst zulässige Legacy-/konkrete Farbnutzungen bleiben nur in zentralen Theme-Definitionsdateien (`theme.ts`, `utils/appTheme.ts`, `utils/appThemeOverlays.ts`, `utils/jsPaletteFallback.ts`) sowie in Tests/Dokumentation, wo konkrete Farbwerte absichtlich verglichen oder Fixtures gebaut werden.
- [x] Architektur-Guard verhindert neue Legacy-Theme-Imports in migrierten Components/Screens und hält hardcodierte Produktions-UI-Farben außerhalb zentraler Theme-Dateien blockiert.
- [x] Kein APK-Build, kein Expo/EAS-Build, keine Dependency-Änderung und keine New-Architecture-Aktivierung in diesem PR.
- [ ] Echter Geräte-Smoke für Samsung/Huawei Dark/Light/Skins bleibt offen.
- [ ] Persistenzprüfung nach echtem App-Neustart bleibt offen.
- [ ] Visuelle Prüfung auf kleinen Displays bleibt offen.


## APK Inspector Tool Lookup Follow-up (2026-07-10)

- [x] PR #276 hat den APK-Inspector-Tool-Lookup von `bash -lc command -v` auf direkte Node-`PATH`-Auflösung umgestellt.
- [x] Android-SDK-Build-Tools bleiben weiterhin als Fallback für `aapt`, `aapt2` und `apksigner` erhalten.
- [x] Die zuvor dokumentierte rote `__tests__/androidApkInspector.test.ts`-Umgebungslücke ist damit als Projektstatus-Restpunkt erledigt; echte APK-/EAS-Builds bleiben weiterhin bewusst separat.
- [x] GitHub-CI für PR #276 war grün: Typecheck, Tests mit Coverage, Lint, Expo Config Gate und Android Manifest Permission Gate.
- [x] Keine Dependency-, Native-, Runtime-, APK- oder Expo/EAS-Build-Änderung.

## DeepScan Performance / Palette / Waveform / Runtime (2026-07-05)

Fortsetzung des unterbrochenen Deep-Scan- und Fix-Durchlaufs. Der vorherige (unterbrochene) Commit `d7b3f62` hatte bereits Performance-, Palette- und Hydration-Punkte inklusive Tests umgesetzt; dieser Durchlauf hat den Waveform-Traceability-Teil ergänzt und validiert.

### Bereits vor diesem Lauf erledigt (Commit `d7b3f62`)
- [x] VirtualizedList/FlatList-Performance: `useLibrarySongRenderer` hält `onPressSong`/`onInfoSong` reference-stabil über Refs; `renderSongItem` ändert sich nur bei `currentSongId`/`isPlaying`/`variant`/`onOpenTrackInfo`. `SongCard` bleibt via `React.memo`-Feldvergleich stabil. Playback-Progress lebt im separaten `PlaybackProgressContext` und rendert die Library nicht neu. `getItemLayout` wird nur im `list`-Modus gesetzt (Grid/Banner bekommen keinen falschen Layout-Estimator). Abgesichert durch `hooks/__tests__/useLibrarySongRenderer.performance.test.tsx`.
- [x] Cover-Palette/Accent-Fallback: `useAlbumPalette` cleared die native Palette synchron beim Artwork-Wechsel und bricht die alte Extraktion per `AbortController` ab (kein stale Grün/Orange). `mergeNativeAndFallbackPalette` lässt native Felder gewinnen und füllt Lücken deterministisch aus dem FNV-Hash-Fallback. Abgesichert durch `useAlbumPalette.test.tsx`, `albumPaletteHelpers.test.ts`, `jsPaletteFallback.test.ts`.
- [x] Hydration-Warnung: `logEmptyPlayableQueueHydration` loggt bei leerer Library / Erststart nur `console.info` mit Counts; nur bei vorhandener Library ohne spielbare URIs bleibt die `console.warn`. Kontext enthält `restoredQueueCount`, `librarySongCount`, `playableQueueCount`, `nativeQueueAction`, `reason`. Abgesichert durch `musicHydrationEmptyQueueLog.test.ts`, `musicHydrationNativeQueue.test.ts`.

### In diesem Lauf ergänzt
- [x] MP3/M4A Waveform-Nachvollziehbarkeit: neuer reiner Helper `utils/waveformDecision.ts` klassifiziert Container (`mp3`/`m4a`/`mp4`/…) und die Native-Entscheidung (`no-uri`, `no-native-extractor`, `native-empty`, `native-unusable-shape`, `native-source-key-changed`, `native-error`, `native-accepted`). MP3 und M4A durchlaufen dieselbe `hasUsefulNativeShape`-Gate und dieselbe `normalizeWaveformPoints`-Normalisierung; ein flaches/degeneriertes natives Envelope wird unabhängig vom Container abgelehnt.
- [x] `extractNativeWaveform` meldet die Entscheidung über einen optionalen `onDecision`-Callback (Rückgabewert und Seeking-/Preview-Semantik unverändert).
- [x] `useSongWaveform` loggt nur in `__DEV__` und nur bei tatsächlich versuchten, dann verworfenen Native-Pfaden (`isNativeWaveformRejectionNoteworthy`) eine kompakte, kontextreiche Zeile – kein Spam bei Fallback-only-Geräten oder Normalzuständen.
- [x] Tests ergänzt: `utils/__tests__/waveformDecision.test.ts` (Container-/Entscheidungs-Klassifikation) und Erweiterung von `utils/__tests__/waveformExtraction.test.ts` (onDecision-Gründe für mp3/m4a inkl. accept/flat/empty/error).

### Nur geprüft/dokumentiert (kein Eingriff)
- [x] npm Deprecated: `npm install --dry-run` gegen die gepinnte `package-lock.json` liefert keine Deprecation-Warnungen; keine Dependency-Version geändert. `package-lock.json` wurde nach dem lokalen Install auf den Repo-Stand zurückgesetzt (npm 10.x hatte nur Metadaten wie `dev`→`devOptional`/`libc` normalisiert, keine Versionen).
- [x] New Architecture bleibt `newArchEnabled=false` (siehe `app.json`, `AGENTS.md`, `docs/architecture/new-architecture-compatibility-audit.md`) – nicht aktiviert, solange `react-native-track-player@4.1.2` gepinnt ist.
- [x] Runtime-Warnungen im Scope geprüft: bestehende `console.warn`-Aufrufe in Library-/Palette-/Waveform-/Hydration-Pfaden decken echte Fehlerzustände ab; kein Warn-Spam für Normalzustände identifiziert.

### Validierung (dieser Lauf)
- [x] `npm run typecheck -- --pretty false` – grün.
- [x] `npm run lint:ci` – grün.
- [x] Ziel-Suiten grün: performance (6), library (456), palette (22), waveform (53), hydration (72), queue (62), metadata (92), trackInfo (41).
- [x] `npx jest --runInBand` gesamt: 1945 grün. 2 rote nur in `__tests__/androidApkInspector.test.ts`, weil in dieser Umgebung `aapt`/`apksigner` fehlen (Umgebungslimitierung, außerhalb des Scopes, schon vor diesem Lauf rot).
- [x] `git diff --check` sauber.

### Follow-up / Not fixed (bewusst offen, größere/fremde Themen)
- `__tests__/androidApkInspector.test.ts`: nachgelagert in PR #276 behoben; siehe Abschnitt „APK Inspector Tool Lookup Follow-up (2026-07-10)“.
- Optionale Waveform-Telemetrie könnte perspektivisch als sichtbares Debug-Overlay im NowPlaying auftauchen – bewusst nicht umgesetzt (keine Now-Playing-Layout-Änderung im Scope).
- Kein EAS Build ausgeführt. Kein Android/APK Build ausgeführt. Android/Samsung/Huawei-Smoke bleibt offen.


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

## Post-V6.6 Cover-/Metadata-/SAF-Fixes (2026-06-20)

Status: Automatisierte PR-Kette #210 bis #215 ist gemerged; echter Android-Dev-Build/Smoke bleibt separat.

- [x] PR #210: SAF-Import-Metadaten und progressives Embedded-Cover-Backfill stabilisiert.
- [x] PR #211: Native `extractAudioInfo(uri)` ergänzt und für SAF/content-Import genutzt.
- [x] PR #212: `albumArtist` über ID3 `TPE2`/`TP2` und Genre-Normalisierung ergänzt.
- [x] PR #213: Sicherer Android-SAF/content-TagWriter für MP3-Texttags ergänzt; Schreibpfad mit persisted Permission, Provider-Flags, Byte-Verifikation und Rollback abgesichert.
- [x] PR #214: `albumArtist` im Tag Editor editierbar gemacht; MP3 schreibt `TPE2`, MP4/M4A schreibt `aART`.
- [x] PR #215: AudioInfo-Backfill für bereits importierte Songs ergänzt; bestehende positive Werte werden nicht überschrieben.
- [x] Alle zugehörigen GitHub-CI-Gates grün: Typecheck, Tests/Coverage, Lint, Expo Config Gate und Android Manifest Permission Gate.
- [x] Keine Dependency-/Expo-/TrackPlayer-/NewArch-Änderung vorgenommen.
- [x] Keine APK gebaut und kein EAS Build ausgeführt.
- [ ] Neuer Android Development Build erforderlich, damit native Änderungen aus PR #211 und PR #213 real auf Gerät verfügbar sind.
- [ ] Echter Android-Smoke für Import, SAF/content-MP3-Texttag-Write, AlbumArtist, AudioInfo-Backfill und Cover-Backfill bleibt offen.

## Bewusst separate Themen

- i18n: keine Migration; App ist dauerhaft Deutsch-only.
- New Architecture: bleibt auf `newArchEnabled=false`, solange `react-native-track-player@4.1.2` gepinnt ist. Eine spätere testweise Aktivierung braucht einen separaten Opt-in-PR oder das passende Dependency-Upgrade inklusive Android Dev-Build und Geräte-Smoke.
- Android Dev-APK Smoke: nach jeder künftigen New-Architecture-Aktivierung zwingend neu ausführen. Bei Build- oder Runtime-Problemen wird per separatem Fix-PR korrigiert oder New Architecture gezielt zurückgerollt.
- V6.6 Android Dev-APK Smoke: offen/manuell; bleibt lokaler manueller Schritt nach Merge der V6.6-Fixes und ist nicht als smoke-final markiert.
- Vollständiger finaler Gesamttest: am 2026-06-12 im V6.6-Final-PR erfolgreich ausgeführt; manuelle Android-Smokes und echte Release-/EAS-Builds bleiben separat.
- Langfristige Import-/Codec-Erweiterungen: nur separat erweitern, damit SAF-, MIME-, Duration- und Parser-Grenzen gezielt getestet werden können.
- SAF/content-Tag-Writes: aktuell für unterstützte MP3/M4A/MP4 Texttag- und Cover-Edits über die native SAF-Streaming-Schreibroute freigegeben; MediaLibrary-`content://` ohne SAF-Grant, alte Native-Builds und unsichere/unsupported Layouts bleiben bewusst blockiert.

## Finale Validierung vor Release oder codex→main-Handoff

Automatisierte Gates (letzter gemergter PR-Lauf am 2026-06-20 erfolgreich):

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
- [ ] Tag Edit/Cover Replace/Remove für unterstützte writable `file://` Titel.
- [ ] SAF/content MP3/M4A/MP4 Texttag- und Cover-Write mit bestehender persisted Permission und Provider-Writable-Flags; fehlende Grants, alte Native-Builds und unsupported Layouts müssen sichtbar blockiert bleiben.
- [ ] AlbumArtist-Anzeige, Gruppierung und Tag-Editor-Speichern.
- [ ] AudioInfo-Backfill für bereits importierte Titel ohne Dauer/Bitrate/SampleRate/Channels.
- [ ] Cover cache cleanup inklusive Orphan-Enumeration.

## Android-Smoke-Fix Cover-Backfill / Metadata Refresh (2026-06-16)

- [x] Android-Smoke-Fund behoben: Cover werden nach Import/Refresh automatisch im Hintergrund nachgeladen.
- [x] SongCard ist nicht mehr der einzige Cover-Ladepfad über Current-Song.
- [x] Metadata Refresh wurde für große Libraries entlastet.
- [x] Keine Dependency-/NewArch-/TrackPlayer-/Native-Änderung.
- [x] Keine APK gebaut.
- [ ] Echter Android-Smoke muss nach Merge erneut laufen.
