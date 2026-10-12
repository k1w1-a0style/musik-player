# Musikplayer – Fortsetzung V5

Stand: 12.10.2026. Verbindliche Grundlage: vollständiger V5-Auftrag aus K1W1_Fortsetzung_V5_KOMPAKT_2026-10-12.zip; V4 und V3 bleiben integriert. Kein Projektneustart.

## Gesicherter Ausgangspunkt

- Repository k1w1-a0style/musik-player, Branch codex, bestätigter Ausgangs-HEAD 8662eb321b59f5fca9e12e2dd5c53cfa9daeac3a. main bleibt unverändert.
- Eindeutige Sicherung: backup/codex-before-v5-20261012-8662eb3. Bestehende V3-Sicherung bleibt erhalten.
- Alle sieben Text-/CSV-Dateien vollständig gelesen (V4-Original und V5-Nachtrag sind bytegetreu im kombinierten Auftrag enthalten); drei Originalscreenshots visuell geprüft.
- Das kompakte Paket enthält 21 Original-Tagdatensätze, aber keine MP3-Audiodateien. Diese Datensätze sind Testreferenzen, kein Nachweis echter Audio-/Coverbyte-Verifikation der Originale.
- V3: Backup in Einstellungen, abschaltbares Resume mit Default Aus, ruhiges Profil, vier Waveform-Akzente und Standard/Kompakt sind vorhanden. QuickScan-Wiederverwendung, begrenzte native Flights, Checkpoint-Ack und vom Scanabschluss getrennte optionale Waveformvorbereitung ebenfalls vorhanden. Diese Funktionen werden erweitert und regressionsgeprüft, nicht nochmals implementiert.
- CI 38180690838 ist abgeschlossen und erfolgreich. Der getrennte Retest 38180690737 scheitert am exakten 1:30-Dauervergleich; grüne Build-/Hostgates ersetzen keine APK-Bedienabnahme.

## Geplant → implementiert → getestet → offen

| Paket | Bereits vorhanden / begonnen | Neue Arbeit | Abnahme |
|---|---|---|---|
| P1 Quellenrevision und APK-Zeitbasis | Resume und Backup, native 1:29-Anzeige tatsächlich belegt | Bekannte MD5-Revision konservativ berücksichtigen; kein SHA-256-Downgrade; codecbedingte Dauer max. 1 s bei app-eigenen Zeitlabels; echte Format-/Swipe-Probes | Hostregressionen; neue exakte APK und öffentliche UI noch erforderlich |
| P2 Scan und Speicherung | QuickScan-Reuse/Flights/Checkpoint/Waveformtrennung vorhanden | Verifizierten Speicherabschluss von optionalem Cleanup mit sicherem Datenbesitz entkoppeln; kleine Statuszeile, Details, Cancel, Warnungen, Erfolg automatisch ausblenden; Profile10/500/2000 | Pending-Storage-/Race-/Canceltests; Androidzeiten und A50 separat |
| P3 Coverfarbe und Player | Aktueller Fallback/stale Hookguards und vorhandene Skins | Persistenter revisionssicherer Budgetcache/Backfill; kurzer/sofortiger Farbwechsel; beide Wechseltextpfade entfernen, Guards und Fehler erhalten; Album/Quelle klar beschriften | Neustart/Race/Revision/Budget; echte schnelle Titelwechsel |
| P4 Darstellung | Quiet/Dichte/vier Waveformfarben vorhanden | Globale UI-Akzente und getrennte Player/Waveform-Auswahl; MiniPlayer-Insets; 320dp/Font2/LivePreview | Theme-/Kontrast-/Layouttests und Androidmatrix |
| P5 Additiver Tag-Cleaner | Manueller Editor und transaktionaler SAF-Writer bleiben | Gemeinsame ID-Auswahl, LongPress/Mehrfachauswahl, Album/Ordner/Playlist/Settings; Regeln/rohe Vorher-Nachher-Receipts/Confidence/Edit/Filter; sequenzielles Apply mit CAS/Cancel/Journal/Export und Display-only | CSV21 plus negative künstliche Fixtures; manuelleEditor-Regression; echte native Kopien |
| P6 Sicherheit F25 | Ausnahmen unverändert bis21.10.2026, Issue396 offen | Frische Upstreamprüfung; kompatibler belegter Fix oder offen ausgewiesener Befund, keine Fristverlängerung/force/Downgrade | Sauberes Install/Audit/JSExport/Native nach Dependencyänderung |
| P7 Finale Auslieferung | V3-Dokumente liegen vorläufig vor | Exakten V5-Commit builden; Paket/ABIs/Signatur/SHA prüfen; vollständige öffentliche UI; aktualisierter Status/Ideenberichte | Keine APK-Freigabe vor erfolgreicher Abnahme; A50-/TalkBack-/Providergrenzen offen ausweisen |

## P1: bestätigte Quellenfehler

Zwei neue Solltests scheitern auf dem veröffentlichten Ausgangscode und bestehen nach der Korrektur:

1. Ein beim expliziten FullScan vorhandener 32-stelliger MD5-Revisionswert wurde beim Resume ignoriert. Bei gleicher URI, Größe und Zeit konnte eine geänderte bekannte Revision eine alte Position erhalten. MD5 ergänzt nun ausschließlich den vorhandenen Größe-/Zeitbeleg; MD5 allein bleibt ungeeignet. SHA-256 bleibt der starke eigenständige Beleg.
2. Backup-URI-Matching mit SHA-256 auf nur einer Seite fiel bisher auf Größe/Zeit zurück. Der fehlende Hashbeleg ist jetzt ein Konflikt statt einer stillen automatischen Zuordnung.

Der bekannte MP3-Retestfehler betrifft eine tatsächliche native Dauer 1:29 bei einem nominellen90s-Clip. Nur app-eigene mm:ss-Labels werden ausgewertet (keine Statusbar-Uhr oder zusammengesetzte Tagtexte), max.1s codecbedingte Abweichung. Dauer wird ausschließlich aus dem echten Timeline-Container gelesen; ein Fall mit anderer Trackdauer bleibt ein Fehler. Je Format/SAF sind mindestens2s plausibler tatsächlicher Positionsfortschritt und app-eigene NativeSessionstate3 mit passendem Titel verlangt. Ein echter horizontaler Coverswipe muss zum öffentlich bestätigten Queue-Vorgänger wechseln und dessen Titel/Dauer/Fortschritt nativ beweisen. Alle31 Python-Diagnose-/Negativtests bestehen. Ein Sliderfallback wird als Timeline erkannt und nicht als fertig analysierte SVG-Waveform ausgegeben.

Hostprüfung: 404 Suiten/3934 Tests vollständig grün,194,175s, Coverage93,61% Statements/85,20% Branches/95,22% Functions/96,09% Lines. Zwei betroffene Suiten24Tests nach abschließender semantisch gleicher Komplexitätsaufteilung erneut grün. Typecheck/strengerLint/SourceNUL(1044)/Komplexität(3742Funktionen) bestehen; Android-Hermesexport/Boundary1638Quellen und generierte Manifestpolicy bestehen. Native Build und genaue UI-Abnahme dieses geänderten Appstands folgen, sie werden nicht aus dem alten3b09201-APK abgeleitet.

## Laufender Übergabepunkt

Vier echte Teilprüfungen wurden beauftragt; Implementierung in getrennten Worktrees, keine konkurrierenden Dateiwriter. Hauptagent integriert kontrolliert und veröffentlicht ausschließlich codex. V5 ist noch nicht vollständig implementiert oder freigegeben. Unsafe Dateirewrites, FLACwrites, Rename/Website-/Unknownframe-Löschung bleiben hinter dem belegten nativen Vertrag; reine Vorschläge und Export müssen dies deutlich zeigen. Native Recovery nach Write ist kein späteres Undo.
