# V4-Nacharbeiten – verbindlicher Ausführungsstand

Stand: 16.10.2026. Auftrag: neun Phasen 0–8, zwölf Findings F01–F12.

## Phase 0: abgesicherter Ausgangspunkt

- `codex`: `93ed893398ce9a59d37a3b4376c418cadf8e02b3` (GitHub und aktualisierter lokaler Checkout).
- `main`: `b62b91b59c7400fd310a5db8fcbf9fc6444ff393`; bleibt unverändert.
- Wiederherstellungspunkt: obiger unveränderlicher Commit sowie lokaler Tag `backup-v4-start-2026-10-16`.
- Vorhandene lokale V5-Treiberänderungen entsprechen exakt dem bereits veröffentlichten Patch a166708a; zusätzlich als Patch und Stash gesichert. Danach sauberer Fast-forward auf 93ed8933. Keine fremden Änderungen überschrieben.
- Letzte fünf GitHub-Läufe sind beendet; keine laufende CI gefunden. Offene Dependabot-PRs #403–#408 werden nicht ungeprüft übernommen. Kein zweiter Schreibagent wird gestartet.
- Beide aktuellen Markdown-Dokumente vollständig gelesen: Arbeitsplan `K1W1_Work_Arbeitsplan_Nacharbeiten_V4_2026-10-16.md` und konsolidierte Review V4 (Version 2, aktualisiert 16.10.). Keine neue Gesamtanalyse.
- Historische V5-Freigabe bleibt erhalten: APK-Quelle `c47b27f6fee2fd826cb3ea023ce4b1aafdb59b06`, SHA256 `91ba080aa732bd2e0af1bf437c53bc90ca6179d9d814fd26c596cec3ef0e18fc`, vollständiger Retest [38777723098](https://github.com/k1w1-a0style/musik-player/actions/runs/38777723098), Artefakt 11995983715. Originale und V5-Bericht werden nicht überschrieben.

## Phasen und Abnahme

| Phase | Umfang | Stand |
|---|---|---|
| 0 | Ist-Abgleich, Sicherung, Status | Erledigt; Ausgangspunkt dokumentiert |
| 1 | F01: zeitkritische Sicherheit | Prüfung erledigt: 47 Jest + 142 Corpus + Clean Install + Hermes-Grenze grün; Fristlösung extern blockiert, keine genehmigte Verlängerung |
| 2 | F02: dauerhafte V5-Originale | Erledigt: beide dauerhaften Original-Downloads rückgelesen; Hashes/ZIP/RSA-v2/Inhaltsdigest/Source/result geprüft; separates Manifest |
| 3 | F03: sichere Journal-Retention | Implementiert und gezielt geprüft; vollständige neue APK-Abnahme folgt |
| 4 | F04/F05/F09: Retest, Handoff, Tracker | Manifest-Retest und neun Negativ-/Positivtests ergänzt; 143 Python-Tests grün; Doku/Issues #234/#236 aktualisiert. Exakte Gesamt-CI folgt in Phase 8 |
| 5 | F06: reale Geräte/Provider/TalkBack | Extern blockiert: kein physisches Gerät/USB/adb; konkrete Abnahmeliste in v4-real-device-gate.md, keine unnötige Emulatorwiederholung |
| 6 | F07/F08/F11: Messung, Infochip, Backup-UX | Host-Basis gemessen, echter Provider-Benchmark extern blockiert; Infochip/Backup-UX korrigiert und gezielt grün; Android-Sichtabnahme folgt |
| 7 | F10/F12: Backend-Vertrag und Patch-Wartung | Erledigt: expliziter begrenzter Vertrag, Upgrade-Ablauf, vier aktuelle Player-Payload-Hashes; 70 gezielte Tests und 146 Python-Tests grün |
| 8 | Endkontrolle, integrierte CI, neue APK, Bericht | Integrierter Lauf angefordert: alle Pakete auf codex gesichert, 146 Python-/gezielte Jest-Gates grün; neue APK und volle eigene Android-/Sichtabnahme erforderlich |

## Findings – laufende Ergebniszuordnung

| ID | Befund | Aktueller Status / erforderlicher Nachweis |
|---|---|---|
| F01 | Audit-Ausnahmen | Extern blockiert hinsichtlich Fristlösung; aktuelle Kompensation frisch bestätigt, siehe v4-security-recheck.md/.json; Ablauf unverändert 21.10. |
| F02 | vergängliche Actions-Artefakte | Bestätigt und behoben: dauerhafte private Originalablage, Rücklese-Hash-/Signaturprüfung und Archivmanifest; V5-Freigabe unverändert |
| F03 | alte Cleaner-Einträge | Bestätigt und behoben; belegte abgeschlossene Epochen werden gesammelt, offene/Legacy-/Recovery-Evidenz bleibt geschützt; v4-cleaner-retention.md |
| F04 | formaler Main-Handoff | Preview und formaler Gesamt-CI-Handoff getrennt; kein Main-Merge autorisiert |
| F05 | fest verdrahteter V5-Retest | Bestätigt und behoben: historischer Workflow unverändert, neuer codex-only Manifest-Dispatch mit Source-/Gate-/ZIP-/APK-Prüfung; Verfügbarkeits-/Geräte-Nachweis folgt |
| F06 | echte Geräte/Provider | Extern blockiert; Verfügbarkeit geprüft, offene Fälle und benötigte Belege konkret dokumentiert |
| F07 | SAF-Hashkosten | Bewusst begrenzt: Host-Basis 10/25/50 MiB gemessen; echter Provider-Benchmark extern blockiert, keine unbewiesene Optimierung |
| F08 | SoundCloud-Infochip | Bestätigt und korrigiert; natürliche Höhe, 48-dp-Aktion, unverkleinerter umbruchfähiger Text; neue APK-/Sichtabnahme ausstehend |
| F09 | Doku/Issue-Drift | Bestätigt und behoben: Handoff/Checklist sowie Issues #234/#236 aktualisiert, reale Prüfungen ausdrücklich offen |
| F10 | Playback-Shim | Bewusst begrenzt: Setup/Options-Vertrag dokumentiert, negative Laufzeitänderungen und volle native Setup-Defaults getestet; kein allgemeines V4-Backend |
| F11 | Backup fehlender Quellen | Bestätigt und korrigiert; verständliche ehemalige ID, alte/neue Version-1-Backups kompatibel, Mapping unverändert; Geräte-Abnahme folgt |
| F12 | gepinnte Payload-Patches | Bewusst begrenzt und abgesichert: installierte Hashes bestätigt, vorhandene Tamper-/Drift-Negativtests grün, verbindlicher Upgrade-Ablauf ergänzt |

## Unveränderliche Arbeitsgrenzen

Keine Änderungen an `main`, kein öffentlicher Produktionsrelease, kein ungefragtes Dependency-Major-Upgrade, keine verlängerten Sicherheitsausnahmen, keine abgeschwächten Tests/Gates. Ausschließlich synthetische Musikdateien. Nach jedem fachlichen Paket gezielte Regressionen und Commit; vollständige CI erst nach Integration zusammengehöriger produktiver Änderungen.

## Integrierte Abnahmeanforderung

Die nächste CI prüft den gemeinsam integrierten produktiven Stand (Cleaner-Retention, SoundCloud-Infochip, Backup-Darstellung). Sie baut genau eine neue Preview-APK, inspiziert Hash/Signatur/Manifest, führt alle bestehenden Quality-/Security-/Native-Gates und die vollständige eigene Android-Abnahme aus. Die zusätzliche SoundCloud-Schriftprüfung liegt vor den aufwendigen Reststufen. Alte V5-Matrixfälle werden für diese APK nicht übernommen. Nachweisbare Infrastrukturfehler werden anhand der Logs behandelt; keine unbegründete Vollwiederholung oder Assertion-Abschwächung.

F01-Fristlösung sowie F06 und der reale F07-Provider-Benchmark bleiben bis zur tatsächlichen externen Erfüllung offen. Ein grüner technischer Lauf hebt diese Grenzen nicht auf.

## F05-Verfügbarkeit nachgeprüft

Der neue reine Dispatch auf `codex` wurde durch die öffentliche GitHub-Workflow-API noch nicht gefunden (404). Deshalb unterstützt der separate Retest zusätzlich einen Push ausschließlich der konkreten `docs/review/apk-retest-request.json`. Die normale CI ignoriert ausschließlich diesen einzelnen Anforderungspfad; bei produktiven oder anderen Änderungen bleibt ihr Trigger bestehen. Source-/Gate-/ZIP-/APK-Prüfungen sind identisch und weiterhin vor jedem Emulatorzugriff Pflicht. 148 Python-Tests sowie beide Workflow-YAMLs sind geprüft. Diese Infrastrukturkorrektur ändert keine APK-Quelle und startet weder eine neue APK noch eine zweite Gesamt-CI.

## Sicherheitsnachtrag F03 vor neuer APK

Der tatsächliche native Ergebnisvertrag enthält `cleanupPending` zusätzlich zu `recoveryPending`. Ein gezielter Test reproduzierte die fehlende Retention-Sperre bei erfolgreichem Write mit ausstehendem Cleanup (1 rot, 13 grün). Jetzt bleiben auch diese Backup-/Operationsbelege erhalten. 83 Journal-/Execution-/Startup-Recovery-Tests sind grün, ergänzt durch Typecheck, betroffene Lint-Dateien und unverändertes Komplexitäts-Gate. Weil produktiver Code geändert wird, ersetzt ein neuer integrierter Source-Lauf die noch laufende Vorprüfung e0f5c2e3/38837709827. Deren 4.159 bestandene Jest-Tests und Security-Gate bleiben historische Zwischenbelege, keine Freigabe der nachgebesserten APK.

## Aktueller technischer Checkpoint – neue APK ddcc7ec2

- APK-Source/Handoff-Prüfcommit: `ddcc7ec2fcb03f68720927c23b06996d59b24dd1`; [CI 38839127042](https://github.com/k1w1-a0style/musik-player/actions/runs/38839127042).
- Quality: 429 Jest-Suiten / 4.160 Tests, 148 Python-Tests, 96 % Zeilenabdeckung; Security- und Native-Job erfolgreich. Native XML unabhängig aufsummiert: 178 Tests, 0 Fehler, 0 Skips.
- Exakte neue APK: 100.832.529 Bytes, SHA256 `2e11157f92a4b09ce39801375ab8f08da42ed3a24a21a7e5dde1b01606afbe2a`; Quell-Artefakt 12020982828, ZIP-Digest `7cd871a3906c6ab4a8d028d47afcb021b038c5e98d42f01eeb7c1def31c8ed7d`.
- APK unabhängig heruntergeladen: kompletter Archiv-Digest/CRC, eingebettete Source, APK-SHA, v2-RSA-Signatur und APK-Inhaltsdigest bestätigt. Alle vier ABIs enthalten, Paket-/Permission-Inspektion erfolgreich. Preview-Testsignatur, keine Store-/Produktionsfreigabe.
- Die zwölf gezielten 200-%-Varianten laufen im isolierten API-35-Emulator; vollständiger Funktionslauf, 36er-Matrix und kritische Sichtprüfung sind noch offen. Dieser Checkpoint erteilt keine APK-Abnahme.
- F01-Fristentscheidung, reale F06-Geräte und F07-Provider-Benchmark bleiben unverändert offen. `main` bleibt unverändert.

## Android-Treiberdiagnose nach zwölf grünen Varianten

Quell-CI 38839127042: drei Source-Gates und zwölf gezielte 200-%-Varianten erfolgreich; Gesamt-CI rot wegen falscher Annahme zur nativen Elternschaft im neu ergänzten SoundCloud-Prüfer. Original-XML und Screenshot belegen sichtbare, korrekt große und getrennte Knoten als native Geschwister. Mit aufgezeichnetem XML reproduziert und korrigiert; 150 Python-Tests grün. Siehe v4-android-native-owner.md. Die APK ddcc7ec2 bleibt unverändert. Vollständiger Manifest-Retest und echter Gesamt-CI-Handoff am korrigierten reinen Treiberstand folgen, ohne neue Preview-APK und ohne Wiederholung der zwölfteiligen Vorstufe.

## Schriftwechsel-Lifecycle nachgewiesen

Der erste Manifest-Retest bestand native Owner-Zuordnung, 100-%-Touchgeometrie und echte TrackInfo-Navigation. Die Logs zeigen den Player nach Zurück weiterhin; erst die anschließende Android-Systemschrift-Änderung initialisierte die Activity zur Bibliothek neu. Der Treiber beginnt deshalb jede Schriftvariante aus der stabilen Library und öffnet den Player ausdrücklich neu. Zustandsbasierte rote/grüne Regression mit aufgezeichnetem Library-XML; 151 Python-Tests grün. Produktive Quellen und APK 2e11157f…afbe2a unverändert. Der finale Handoff-Prüfcommit wird gegen diese konkret nachgewiesene Treiberkorrektur festgelegt; frühere grüne Source-Gates werden nicht als Gesamt-CI eines späteren Commits ausgegeben.

## Eng begrenzte Fortsetzung: Song-Info-Scrollen bei 200 %

Reguläre CI 38844315073 am Commit 26644d3a vollständig grün bestätigt. Manifest-Retest 38844390898 auf 6271b300 scheitert erst nach den Funktionsstufen und 25 erfolgreichen Matrixfällen in 200 % / dark / graphite / compact. Original-Artefakt 12024085233 vollständig hash-/CRC-geprüft. XMLs 460–483 zeigen schnelles Überschwingen im 194-px-Listenfenster, keine Mini-Player-Verdeckung dieses Fensters. Bereits lokalisierte, abgeschnittene Song-Aktionen erhalten deshalb kurze langsame Gesten. Aufgezeichnete Regression erst rot, dann grün; alle 154 Python-Tests erfolgreich, kein Skip. Nur Treiber-/Test-/Dokumentationsänderungen, kein Build und kein vollständiger Android-Wiederholungslauf. Die elf fehlenden Matrixfälle und Android-Nachprüfung der Korrektur bleiben ausdrücklich offen. Belege und Grenzen: [v4-song-info-scroll.md](v4-song-info-scroll.md).

## Android-Einzelfall tatsächlich bestanden

Lauf 38867090788 / Harness 72a19aec ist grün. Artefakt 12032061690 unabhängig hash-/CRC-geprüft, korrekte APK 2e11157f…afbe2a. Die vormals fehlerhafte Info-Aktion ist vollständig 72 × 72 px und tatsächlich bedienbar. Kritische PNG-Sichtkontrolle bestätigt die XML-Geometrie. 26/36 Matrixfälle nachgewiesen; zehn weitere exklusiv vorbereitet. 159 Python-Prüfungen grün. Details und Grenzen in v4-song-info-scroll.md.
