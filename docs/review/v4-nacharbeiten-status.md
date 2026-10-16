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
