# Musikplayer – V5-Abnahme, 14.10.2026

Die V4-/V5-Arbeit wird im bestehenden Projekt fortgesetzt. App-Quelle: `70275c7a66aa9d24e5c2a33421388d93ad9a20d6`. Alle späteren Änderungen betreffen Abnahmetreiber und Statusdokumentation. `main` bleibt unverändert.

**Freigabestatus: 26 von 36 UI-Fällen bestanden; zehn noch offen. Keine finale APK-Freigabe.** Dieser Zwischenstand wird erst nach Prüfung aller 36 Kombinationen ersetzt.

## Geplant → implementiert → geprüft → Grenzen

| Paket | Implementierung | Nachweis | Grenze |
|---|---|---|---|
| Bestehende V4/V3-Funktionen | Backup, abschaltbares Resume mit Default Aus, ruhiges Profil, Waveformfarben, Dichte, Quickscan-Reuse und native Flights übernommen | Regressionssuite und echte öffentliche Android-Bedienung | Keine erneute Implementierung |
| Speicherung und Scan | Manifest-ACK vor optionalem Cleanup; Besitz-, Epoch-, Race- und Fehlerguards; atomarer Legacy-MultiRemove; kompakter Status, Details, Cancel, Warnungen und Erfolgsausblendung | Vollständige Jest-/Native-Gates; MediaStore- und SAF-Import; öffentliche optionale Waveform-Cancellation mit drei terminalen ACKs | Host-Quickscanprofile sind keine A50-/Provider-IO-Messung |
| Wiedergabe, Queue, Resume | Native atomare Queue-Ersetzung; MiniPlayer-Layoutmessung bleibt erhalten; Titel/Timeline-/Sessionidentität und Resume-Revisionsbelege | MP3/M4A/FLAC/SAF mit tatsächlichem native Positionsfortschritt; 2→5 Queue; Drag, Cover-Geste, Hintergrund; Resume Ein/Aus nach echtem Prozessneustart | Nur isolierter Android-35-Emulator, kein neuer A50-Vergleich |
| Darstellung und Farben | Getrennte globale, Player- und Waveform-Akzente; 12 Wahlmöglichkeiten je Präferenz; sofortiger Farbwechsel; beide Playerlayouts; ruhiges Profil und Dichte | Alle 36 öffentlichen Radio-Wahlen, drei unterschiedliche persistierte Präferenzen und beide Layouts nach Kaltstart | Vollständige Schrift-/Theme-/Dichte-Matrix noch laufend |
| Tag-Cleaner | Gemeinsame ID-Auswahl und LongPress, mehrere Einstiegspunkte, Regeln, rohe Vorschau, Confidence, manuelle Anpassung, Filter, Display-only und sequenzieller SAF-Write mit CAS/Cancel/Journal/Export | 21 Referenz-Tagdatensätze und negative Host-/Native-Fälle; echter synthetischer SAF-MP3: Vorschau/Display-only bytegleich, Kaltstart idempotent, physische Korrektur erfolgreich; Audio/APIC/TPUB/WXXX/zwei ReplayGain-TXXX/XKIW/.lrc erhalten | Keine Original-Audiodateien im Übergabepaket; keine Originalmusik verändert. Unsichere Rename-/FLAC-/Website-/Unknownframe-Rewrites bleiben Vorschau/Export |
| Backup/Restore | Echter SAF-Export, read-only Inspection, explizite Preview/Restore; additive Kopie mit Original, IDs, Reihenfolge und Favorit | Live und nach Kaltstart öffentlich geprüft; Exportdatei unabhängig gelesen | Sammlungssicherung enthält keine Audiodateien; transaktionale Recovery ist kein späteres Undo |
| Sicherheit | Vorhandene strikte Audit-, Manifest-, Bundle-, NUL- und Komplexitätsgates unverändert | Source-CI 38444159146: Qualität, Security, Androidbuild und 178 native Tests erfolgreich | Issue #396: befristete bestehende Ausnahmen bis 21.10.2026, keine Null-Befund-Auditbehauptung |
| Auslieferung | Unveränderte exakt gebaute APK erneut genutzt, kein unnötiger Build | Alle Stufen durch Quelle/Digest und immutable Artefakte zugeordnet | Freigabe erst nach vollständiger UI-Matrix |

## APK-Identität

- Quelle: `70275c7a66aa9d24e5c2a33421388d93ad9a20d6`
- Source-CI: [38444159146](https://github.com/k1w1-a0style/musik-player/actions/runs/38444159146)
- Originalartefakt: [11838417686](https://github.com/k1w1-a0style/musik-player/actions/runs/38444159146/artifacts/11838417686)
- APK: 100.825.389 Bytes; SHA-256 `f1d587e8ddbd5d1bd7cfbb07ba9104a55d8d17bd94c372babaadbe1df6831807`
- ZIP SHA-256: `5c3a0c94d96da1f4d2a03c2fb3c3633ef936f556a4a0fe11a983a7fed97568fd`
- Package: `com.k1w1a0style.musikplayer`; Version 1.0.0 / Code 1; minSDK 24, targetSDK 36.
- ABIs: arm64-v8a, armeabi-v7a, x86, x86_64. APK-v2-Signatur geprüft.
- Öffentliches Preview-Testzertifikat SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Keine behauptete private Store-/Produktionssignierung.

Eine frühere lokal unvollständige Downloadkopie wurde separat gesichert und durch den unabhängig geprüften vollständigen Originaldownload ersetzt. Sie ist kein Auslieferungsartefakt.

## Qualitäts- und Sicherheitsbelege

Die drei wiederverwendeten Source-Gates gehören exakt zum APK-Commit; jeder APK-Retest kontrolliert dies und den vollständigen Datei-Digest vor Gerätezugriff.

- 427 Jest-Suiten / 4.133 Tests; Coverage 92,92 % Statements, 85,31 % Branches, 94,03 % Functions, 95,98 % Lines.
- Source-CI: 65 Python-Diagnose-/Negativtests. Der fortgesetzte Treiber ergänzt gezielte Regressionen; letzte Matrixversion: 117 Tests vor Gerätezugriff.
- TypeScript, strenger ESLint, Komplexität (4.207 Produktionsfunktionen), NUL-Gate (1.106 Quellen), Hermes-/Bundle-Boundary (1.682 Quellen), Expo- und Manifestgates erfolgreich.
- Android: 168 SystemAudio- und 10 RNTP-Tests, insgesamt 178, plus erfolgreicher nativer Build.
- Produktionsaudit: 0 kritisch, 23 hoch, 5 moderat. Bestehende Ausnahmen aus [Issue #396](https://github.com/k1w1-a0style/musik-player/issues/396) gelten nur bis 21.10.2026. Keine Ausnahme verlängert, kein Sicherheitsgate abgeschwächt.

Die ursprüngliche Gesamt-CI war wegen ihrer UI-Stufe **nicht** vollständig grün. Die drei Source-Gates sind grün; spätere Android-Abnahmebelege werden separat und bytegenau zugeordnet.

## Unveränderliche native Stufenbelege

| Stufe | Lauf / Harness | Abschlussbeleg |
|---|---|---|
| Formate, SAF, Queue, Resume, Hintergrund, Gesten, Backup/Restore | [38485945141](https://github.com/k1w1-a0style/musik-player/actions/runs/38485945141), `8c9ef09274c303a26ee16441ed2862a924874156`; Artefakt 11860034815 | Alle Funktionen dieser Stufen kehrten erfolgreich zurück; Folgefehler erst beim nachfolgenden Farben-Kaltstart. Native Resume: gespeichert 258 s, Start 258,011 s, pausiert 268,786 s, Androidzeit 10,970 s, eingefrorene UI 268 s. |
| Farben und Persistenz | [38493618238](https://github.com/k1w1-a0style/musik-player/actions/runs/38493618238), `afe6cc2f111598906c6b9f7a1073a0c76e5548d4`; Artefakt 11862572701 | `stage-progress.json`: Farbenstufe abgeschlossen, 12 Optionen pro Präferenz; App purple, Player cyan, Waveform blue, instantColors true; classic und soundcloud. Folgefehler erst beim Cleaner-Systempicker. |
| Cleaner mit echten SAF-Bytes | [38499858377](https://github.com/k1w1-a0style/musik-player/actions/runs/38499858377), `fd29e3e2bb71c347d6e403b566aa06cef68a1e3a`; Artefakt 11866222091 | `stage-progress.json`: komplette Cleaner-Transaktion abgeschlossen. Folgefehler erst bei einer abgeschnittenen Menüfläche in der UI-Matrix. |
| 36 UI-Kombinationen | [38502985939](https://github.com/k1w1-a0style/musik-player/actions/runs/38502985939), `956aa2411c67ba890369a686b6ffdb402070f99a` | 26 Fälle bestätigt, nur zehn 200-%-Fälle noch offen. Ursache im Treiber: Richtungswechsel vor bestätigtem oberen Listenrand. 320 dp; Schrift 1,0/1,3/2,0 × hell/dunkel × graphite/minimal/neon-cover × Standard/Kompakt. Originale 48-dp-/Nichtüberlappungsbedingungen unverändert. |

Eine Stufenabnahme allein setzt `releaseAccepted` bewusst nicht auf true. Erst die vollständige Kombination aller bytegleich zugeordneten Belege kann die finale APK-Abnahme ergeben.

### Unabhängige Cleaner-Dateiprüfung

Nur generierte Sinus-MP3 und generierte Sidecar-Datei wurden bearbeitet. Die Original-Tagdatensätze dienen als separate Vorschlagsreferenz.

- Original SHA-256 `e13be3f15bbfcf0edb4795a30cefdd7c3fc2df75d4075c662ee8425fc841e403`; Ergebnis `52af83343fefdf327132edb01c2e8548dab16d80de10c7f3c1122b0a1c1c7806`.
- Encodierte Audioframes exakt gleich, SHA-256 `18b420012bef6db2dc00075a558639f89b56778fd13fc9f6768f41e5729fc3d0`.
- APIC, TPUB, WXXX, beide TXXX-ReplayGain-Werte und XKIW exakt erhalten. Unabhängiges ffprobe: MP3 plus Cover, 75,075918 s; bereinigte Title/Artist, Album und Publisher vorhanden.
- Sidecar SHA-256 `1a134e289fcb2e27a7973df560d03fc3600e40d5a3f073ebfd619bff105f2638`, vorher/nachher identisch.
- UI-Ergebnis: 1 geprüft, 1 geändert, 0 übersprungen, 0 Konflikte, 0 fehlgeschlagen, 0 offen.
- Read-only Vorschau und reine Anzeigekorrektur ließen die Originaldatei exakt unverändert; Kaltstart bestätigt gespeicherte/idempotente Anzeigekorrektur.

[Unabhängige Artefaktlesung 38504053136](https://github.com/k1w1-a0style/musik-player/actions/runs/38504053136) bestätigt gespeicherte JSONs, tatsächliche Dateihashes und Screenshots ohne neuen Emulator.

## Ursache der Unterbrechungen und effizienter weiterer Betrieb

Der ursprüngliche Abbruch mit `AdbError: closed` und offline-Emulator enthält keinen eindeutigen app-eigenen FATAL-Beleg. Er wurde als Transport-/Infrastrukturfehler untersucht. Ein späterer begrenzter Reconnect behielt dieselbe Bootidentität und Appzustand; andere echte Fehler wurden aus ihren nativen XMLs statt aus pauschalen App-Absturzannahmen isoliert.

Nachgewiesene Treiberursachen: Settings-Fling übersprang eine vollständige Zeile; Host-RPC-Endzeit wurde mit einer älteren Timeline verglichen; Recoverybanner überdeckte ein vorhandenes Menü; Appnavigation wurde vor asynchronem Systempicker gewählt; Breadcrumb-Textenabled war Styling bei eigenem RecyclerView-GestureDetector; noch laufende optionale Waveformarbeit blockierte Backup korrekt; nach Kaltstart musste die native Queue vor Cleaner erneut öffentlich ausgeschlossen werden; Android zeigte bereits auf den Scrollparent abgeschnittene Menürechtecke.

Alle Korrekturen erhalten echte ACK-, Eigentümer-, Queue-, Clipping-, Positions-, Byte-, Sicherheits- und Ergebnisassertions. Kein Blind-Retry nach unverändertem Fehler, kein paralleler schreibender Agent. QA Wolf wurde nicht verwendet. Limrun war erreichbar, hatte jedoch keine zum aktuellen Digest zugeordnete installierte APK und keinen eingerichteten lokalen CLI-/ADB-Pfad; es gab keinen neuen Login-/Setupversuch.

Die lokale Work-VM antwortet zeitweise ausdrücklich mit `environment_offline` bzw. getrennter exec-Verbindung. Ein historischer Codex-Abbruch nennt ein Nutzungslimit. Daraus folgt kein nachgewiesener allgemeiner Pluginfehler. GitHub-Tests laufen unabhängig weiter. Wertvolle lokale Entwürfe wurden vor dem Ausfall durch Patch/Stash/Commit gesichert; veröffentlichte Arbeitspakete stehen auf codex.

## Messgrenzen und spätere Ideen

Kein neues Gesamt-Deep-Scan. Vorhandene V4-Berichte und Ideen bleiben erhalten. Die JS-Quickscan-Messungen führen reale JS-Discovery/Revisions-/Workerpfade mit sofortigen Providerdoubles aus; sie ersetzen keine Messung langsamer Android-SAF-Provider, CPU/RAM/Jank oder eines Samsung A50. Sprach-TalkBack und eine vollständige externe Providermatrix wurden nicht tatsächlich geprüft und werden nicht als bestanden ausgegeben.

Die relevanten nächsten Erweiterungen sind echte A50-Baseline/Profiling, gesprochene TalkBack-Abnahme, tiefe/langsame/abbrechende SAF-Provider, zusätzliche native Container für sicheren Tag-Write und optionales dauerhaftes Audio-Undo mit Platzbudget. Dies sind ausgewiesene Folgearbeiten, keine Zusage vorhandener unsicherer Dateirewrites.
