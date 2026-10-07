# V2 — Implementierung, Nachweise und Freigabegrenzen

## Branch-Sicherung und Umfang

Vor den Änderungen wurde `main` nicht-destruktiv auf den bisherigen `codex`-Commit `6167e7d7c70fcced10abc71ad6b12ffebe4089df` vorgezogen. Der alte Entwicklungsstand bleibt dort erhalten. Die V2-Implementierung wird ausschließlich auf `codex` veröffentlicht. Keine Force-Pushes, kein `npm audit fix --force`, keine neue Architektur und keine ungeprüften SDK-/RNTP-Major-Upgrades.

Die vier zusätzlichen Reviews wurden als Hypothesen gegen Code, Fehlerpfade und bestehende Verträge geprüft. Die folgende Matrix ordnet die 20 bestätigten V2-Funde den Änderungen zu. Code-Implementierung, administrative GitHub-Einstellungen, akzeptiertes Restrisiko und Geräte-Freigabe sind getrennte Zustände.

## Befund → Änderung → Regression

| V2 | Änderung | Hauptnachweis |
| --- | --- | --- |
| 01 CI-Kopplung | Unabhängige Security-/Quality-/Native-Jobs; `always()`-Aggregat akzeptiert nur drei Erfolge. Fehlerhafte Audits verdecken keine unabhängigen Quality-/Native-Ergebnisse. | `workflowCiStrategy.test.ts`, reale drei CI-Jobs |
| 02 Branch-Schutz | `Required release checks` als stabiler Pflicht-Check vorbereitet. GitHub-Einstellung für `main`/`codex` ist außerhalb der Workflow-Datei erforderlich. Kein Bypass oder Force-Push zum Einrichten. | Administrative GitHub-Verifikation separat; aktuell noch nicht abgeschlossen |
| 03 Audit | Kompatible Tooling-Patches; korrekte Wurzelauflösung einschließlich Zyklen; zwei exakte, befristete High-Ausnahmen statt pauschalem Allowlist-Risiko. Produktions-Bundle-Gate verhindert Runtime-Einzug. | `checkNpmAudit.test.ts`, `checkAndroidBundleDependencies.test.ts`, [Risk Register](../../security/npm-audit-risk-2026-10-07.md) |
| 04 Native Hänger | Bounded Playback-Watchdog und sichtbarer Recovery-Status. Timeout beendet das UI-Warten, nicht die tatsächliche native Mutation. Writer bleibt bis Settlement gesperrt. | `nativePlaybackRegression.test.ts`, `useNativePlaybackRecovery.test.tsx` |
| 05 Queue-Readbacks | Unnötige doppelte Readbacks im Rebuild entfernt; Identitäts-/Stale-Prüfungen bleiben bestehen. Keine behauptete Geräte-Latenz aus Call-Counts. | Queue-/Hydration-/Playback-Regressionen |
| 06 Playback-Intents | Neueste Song-Auswahl zusammenfassen; Next/Previous-Deltas geordnet anwenden, bestätigte Queue-Edits erhalten, Pause/Stop priorisieren. Sichtbare Auswahl getrennt von bestätigtem Song. | Playback-Controls/-Queue-Tests und `PlaybackSelectionNotice.test.tsx` |
| 07 Seek | Song-/Generation-bezogener Seek-Puffer. Ergebnis eines erfolgreichen Seeks hängt nicht an einem späteren hängenden Seek; Queue-Barriere wartet weiterhin auf den echten Drain. | `seekController.test.ts`, erfolgreiche A-/hängende B-Regression |
| 08 Remote / Hydration | Bounded Remote-Intent-Buffer, korrekte Service-Lebensdauer und Stop-Priorität. Sleep-Timer prüft nach spätem Readback erneut den Hydration-Guard. | `PlaybackService.test.ts`, `remotePlaybackIntentBuffer.test.ts`, `sleepTimerController.test.ts` |
| 09 Waveform-Wahrheit | Analyse-Historie getrennt von real verfügbarer Cache-Datei. Waveform-/Bass-Vorbereitung ist keine Abspielbedingung für lesbares Audio. | `libraryPreparedPlayback.test.tsx`, Cache-/SongCard-/Preload-Tests |
| 10 Cache-Startup / Budget | Kleines Manifest statt alle Payloads im Startpfad; lazy Datei-Reads, Validierung und Legacy-Migration. Disk-Budget 128 MiB, Manifest 8 MiB, RAM 80 Einträge/8 MiB; fehlgeschlagene Löschung stoppt weiteres Disk-Wachstum. | `waveformCacheManifest.test.ts`, `waveformFileStore.test.ts`, `waveformCache.test.ts` |
| 11 Waveform-Scheduling | Event-Wakeup und endliche Wartedauer statt dauerhaftem 150-ms-Polling. Bounded UI-Cache-Read mit Stale-Guard. | `waveformExtractionLifecycle.test.ts`, `useSongWaveform.test.tsx` |
| 12 Bass / Rendering | Maximal 96 Peak-erhaltende Punkte im sichtbaren Fenster; vollständige Analyse bleibt für Genauigkeit erhalten. | `coverBassPulse.test.ts`, `useCoverBassPulse.test.tsx` |
| 13 Quick / Full Scan | Quick Scan hasht auch bekannte undatierte Provider-Dateien nicht vollständig; unbestätigte Revisionen werden sichtbar gezählt. Separater Full Scan prüft Inhalt und aktualisiert Revision/Analyse. | `importFileRevision.test.ts`, Import-/Menü-Tests |
| 14 Große / langsame Imports | Zwei aktive native File-Reads, per-file Deadline und resettable 90-s-Inaktivität; echte noch laufende Native-Reads behalten Slots. Bestätigte Delta-Checkpoints zuerst, dann in 20er-Chunks; Retry übernimmt akzeptierte Revisionen. | Budget-/Progress-/Lifecycle-/SAF-Import-Tests |
| 15 Equalizer | Native Session/Effect-Lifecycle serialisiert; Destroy/Generation-Guards. JS-Slider schreibt gedrosselt, nur Änderungen und zuletzt bestätigte Werte; Enable bleibt unmittelbar. | `SerializedSessionEffectTest.kt`, Equalizer-Jest-Tests |
| 16 Cover / Palette | Validierte, fsync-/rename-basierte atomare Cover-Veröffentlichung; explizite owner-bezogene Native-Leases bis Copy/Discard/Destroy. JS-Handoff schützt akzeptierte Cover schon vor dem Persistenz-Effect. Palette höchstens 256×256 / 65.536 Pixel. | `AtomicArtworkCacheTest.kt`, Lease-/Late-Discard-/Backfill-/Import-Tests, `acceptedCoverHandoff.integration.test.ts` |
| 17 Persistenz | Ab 100 Songs 350-ms-Coalescing mit spätestens 2-s-Flush; Background/Unmount sichern neuesten Snapshot. Cover-Leases sofort, Disk-Cleanup erst nach bestätigter Persistenz. | `usePersistedSongs.test.tsx`, Cover-Lifecycle-/Handoff-Integration |
| 18 EAS-Upload | Lokale Env-, Signing-, Credential-, npmrc-, Backup- und Build-Artefakte aus `.easignore` ausgeschlossen; notwendige Quellen bleiben enthalten. | `easUploadExclusions.test.ts` mit Dummy-Pfaden; echte Signing-/Upload-Abnahme separat |
| 19 Plattform-Lebenszyklus | Stabiler bestehender Stack bleibt unverändert; isolierter Upgrade-Pilot mit Lizenz-/API-Prüfung, Vertrags-Matrix, echten Builds und Rollback. | [Migrationspilot](../architecture/platform-migration-pilot-2026-10-07.md), unverändertes `newArchEnabled=false` |
| 20 Wartbarkeit | Gemeinsames npm-Setup für die drei CI-Jobs, `.nvmrc` auf Node 22, gezielte Dependabot-Gruppen und kohäsive Scheduler-/Persistenz-/Cache-Helfer. Coverage-/Komplexitäts-Grenzen unverändert. | Workflow-/Komplexitäts-/Typecheck-Gates; bestehende manuelle Build-Workflows bleiben kompatibel mit der gesicherten Basis |

## Wichtige nicht kaschierte Grenzen

1. Ein dauerhaft hängender RNTP-Aufruf lässt sich per JavaScript-Promise nicht abbrechen. Die UI zeigt den Fehler; Retry darf erst wieder schreiben, wenn der tatsächliche Flight settled ist. Kein künstliches Freigeben des Locks nach Timer.
2. Import-Retry ist ein **Revisionen-/Ergebnis-Checkpoint**, kein dauerhaft gespeicherter Provider-Verzeichnis-Cursor. Verzeichnisse werden erneut enumeriert, akzeptierte unveränderte Ergebnisse wiederverwendet. Provider-Snapshots können sich ändern; ein blinder alter Offset könnte Dateien verlieren.
3. Neue Native-Leases benötigen einen neuen Development-/Release-Build. Der additive JS-Wrapper bleibt mit älteren Modulen kompatibel, kann dort aber keine fehlende native Lease-Garantie nachrüsten.
4. Persistente Waveforms sind ein begrenzter Cache, keine Garantie für unbegrenzte Offline-Historie. Evictete/fehlende Dateien werden ehrlich als nicht verfügbar behandelt und blockieren kein Audio.
5. Audit-Ausnahmen sind offen bis zu ihrem Ersatz und laufen am 2026-10-21 aus. CI-Grün bedeutet **Policy erfüllt**, nicht „keine Vulnerabilities“.
6. Administrativer Branch-Schutz benötigt GitHub-Owner-/Sudo-Bestätigung. Er ist nicht durch Commit oder Plugin-Inhaltszugriff allein hergestellt.

## Integrationsnachweise

Der erste vollständige Coverage-Lauf machte vier Regressionsgruppen sichtbar: alte Erwartungen zum Waveform-Abspielgate, veraltete Next-/Previous-Mock-Calls, das neue Stale-Seek-Ergebnis und fehlende Theme-Tokens im Statushinweis. Produktionsverträge und Tests wurden zusammen geprüft; Coverage-Schwellen, Jest-Mocks und Komplexitäts-Baseline wurden nicht abgeschwächt.

Abschließender lokaler Lauf nach dem Freeze aller Produktionsdateien am 2026-10-07:

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges `npm run test:coverage -- --runInBand` | **348 Suites / 3.368 Tests grün**; Statements 93,17 %, Branches 84,70 %, Functions 94,89 %, Lines 95,66 %; alle unveränderten globalen und Dateischwellen erfüllt |
| `npm run typecheck` / `npm run lint:ci` | Beide erfolgreich; keine TypeScript-Fehler / keine ESLint-Warnungen |
| `npm run check:complexity` | Erfolgreich für 3.254 Produktionsfunktionen; Baseline unverändert |
| `npm run check:source-nul` | Erfolgreich für 886 Text-Quelldateien |
| Python-CI-Diagnostiktests | 13 Tests erfolgreich; simulierte ADB-Fehler sind Testfälle, kein Geräte-Smoke |
| Produktions-Expo-Konfiguration / generiertes Android-Manifest | Beide Gates erfolgreich; `newArchEnabled=false`, keine Mikrofon-/Kamera-/Overlay-Berechtigung |
| Frischer Produktions-Android-Hermes-Export / Bundle-Gate | Erfolgreich; 1 Source Map / 1.563 Quellen; keines der vier ausgeschlossenen Tool-Pakete im Bundle |
| Aktueller Produktions-npm-Audit / exakte Policy | 0 Critical, 21 High-/5 Moderate-Graph-Einträge; 2 unabhängige High-Wurzeln mit befristeter Ausnahme, 19 transitive High-Effekte; Policy erfolgreich, **nicht vulnerability-frei** |
| Diff / zusätzliche YAML-Konfiguration | `git diff --check` und Parse von Composite-Action / Dependabot erfolgreich |

GitHub bestätigt anschließend denselben veröffentlichten Tree auf der CI-Node-Linie und im Native-Job. Bis dahin ist Native-/Online-Expo-Verifikation ausdrücklich offen. Einzelne grüne Fokus-Suites ersetzen keinen Gesamtnachweis.

Lokal stehen Node 24 und JDK 17 zur Verfügung; CI nutzt die Node-22-Linie aus `.nvmrc`. Android-SDK/Gradle-Distribution sind lokal nicht vollständig verfügbar; der Gradle-Download scheiterte an der Netzwerkfreigabe. Daher wird Kotlin-/Native-Compile ausschließlich durch den unabhängigen GitHub-Native-Job bestätigt. Ein Offline-Expo-Abhängigkeitscheck ist nur ein Teilnachweis; CI führt den Online-Check aus.

## Geräte-/Build-Abnahme vor Release

Keine APK/AAB und kein kostenpflichtiger EAS-Build werden von der normalen CI erzeugt. Vor Release müssen folgende Nachweise am **neuen nativen Build** ergänzt werden:

- Reales A50 bzw. schwächeres Android-Gerät: schnelle Songwechsel, Seek/Songwechsel, Next/Previous-Serien und sichtbarer Timeout-/Retry-Pfad.
- Notification, Lockscreen, Bluetooth, Background/Screen-Off, Audio Focus und Neustart mit gespeicherter Queue/Seek.
- Mindestens 1.000 Titel / langsamer SAF-Provider: Quick versus Full Scan, keine Quick-MD5-Reads, tatsächlicher Teilfortschritt, Abort und Retry; Native-Hänger dürfen nicht unbegrenzt neue Reads starten.
- Große Cover und Cache-Druck während langer Kopie; App-Destroy/late receipt; kein verschwundenes akzeptiertes Cover. Equalizer-Session-Wechsel unter laufendem Slider.
- Cold-/Warm-Start, Waveform-Persistenz nach Neustart, RAM-/Disk-Budgets und Liste ohne Vorbereitungs-Abspielblockade.
- Echter EAS-Source-Archive-/Signing-Check mit Dummy-Secrets und separat bereitgestellten Credentials; Original-Audiodateien unverändert nach Fehler/Abbruch im Tag-Writer.

Diese Geräte-/Signing-Prüfungen sind keine behaupteten Ergebnisse dieses Code-/CI-Laufs. Sie bleiben explizite Release-Freigaben, nicht versteckte Restarbeiten.
