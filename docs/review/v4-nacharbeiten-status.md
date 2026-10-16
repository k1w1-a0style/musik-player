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
| 3 | F03: sichere Journal-Retention | Offen |
| 4 | F04/F05/F09: Retest, Handoff, Tracker | Offen |
| 5 | F06: reale Geräte/Provider/TalkBack | Verfügbarkeit prüfen; Emulator ist kein Hersteller-/TalkBack-Nachweis |
| 6 | F07/F08/F11: Messung, Infochip, Backup-UX | Offen; nur bestätigte Defekte ändern |
| 7 | F10/F12: Backend-Vertrag und Patch-Wartung | Offen |
| 8 | Endkontrolle, integrierte CI, neue APK, Bericht | Nach zusammenhängenden Korrekturen; keine historische APK umetikettieren |

## Findings – laufende Ergebniszuordnung

| ID | Befund | Aktueller Status / erforderlicher Nachweis |
|---|---|---|
| F01 | Audit-Ausnahmen | Extern blockiert hinsichtlich Fristlösung; aktuelle Kompensation frisch bestätigt, siehe v4-security-recheck.md/.json; Ablauf unverändert 21.10. |
| F02 | vergängliche Actions-Artefakte | Bestätigt und behoben: dauerhafte private Originalablage, Rücklese-Hash-/Signaturprüfung und Archivmanifest; V5-Freigabe unverändert |
| F03 | alte Cleaner-Einträge | Auf aktuellem Code reproduzieren; aktive/unvollständige Recovery strikt schützen |
| F04 | formaler Main-Handoff | Preview und formaler Gesamt-CI-Handoff getrennt; kein Main-Merge autorisiert |
| F05 | fest verdrahteter V5-Retest | Historisches Harness konservieren; separater wiederverwendbarer strenger Vertrag |
| F06 | echte Geräte/Provider | Offene Nachweislücke, nicht automatisch ein Produktfehler |
| F07 | SAF-Hashkosten | Provider-Messung vor Optimierung; Hostzahlen nicht als Gerätebenchmark ausgeben |
| F08 | SoundCloud-Infochip | Bekannter nicht blockierender V5-Restpunkt; neue responsive UI und neue APK-Abnahme erforderlich |
| F09 | Doku/Issue-Drift | Gegen aktuelle Emulatorbelege aktualisieren; reale Tests offen lassen |
| F10 | Playback-Shim | Bewusste API-Begrenzung; Vertrag und Drift-Negativtests prüfen |
| F11 | Backup fehlender Quellen | Konservative Referenzen erhalten, Darstellung verbessern, Format kompatibel halten |
| F12 | gepinnte Payload-Patches | Bestehende Hash-/Negativtests bewahren, Wartungsablauf konkretisieren |

## Unveränderliche Arbeitsgrenzen

Keine Änderungen an `main`, kein öffentlicher Produktionsrelease, kein ungefragtes Dependency-Major-Upgrade, keine verlängerten Sicherheitsausnahmen, keine abgeschwächten Tests/Gates. Ausschließlich synthetische Musikdateien. Nach jedem fachlichen Paket gezielte Regressionen und Commit; vollständige CI erst nach Integration zusammengehöriger produktiver Änderungen.
