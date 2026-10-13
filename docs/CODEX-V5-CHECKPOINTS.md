# V5 - kompakter Fortsetzungsstand

Stand: 12.10.2026. Feature-Quellcommit e8c30d34ac86a1ef40801ce46532638fbe58fc1f auf codex; main unverändert. Dieser Folgecommit ergänzt die SDK-Patches und den V5-Gerätetreiber. Aktuellen HEAD mit git rev-parse HEAD ablesen.

## Implementiert und gezielt verifiziert

- Getrennte Tag-Bereinigung mit roher ID3/MP4-Vorschau, konservativen Regeln, Feldfreigabe, bestätigter Bibliotheksanzeige, reserviertem SAF-CAS, Queueprüfung, Transaktionsschutz, Abbruch zwischen Dateien und O(1)-Journaleinträgen. Kommentare, Cover und unbekannte Frames bleiben geschützt; Rename/Website-Entfernung nur Vorschau/Export.
- Mehrfachauswahl und Album-/Ordner-/Playlist-Einstiege; echte Settings/Navigation/Provider-/Backup-Verträge integriert.
- Scan-Speicherabschluss unabhängig von optionalem Cleanup, echte IO-/Epochbesitzer; kompakte Statusanzeigen mit konkretem Fehler und Quick-/Full-Retry.
- Budgetierte Quickscan-Yields. 8 Workloads x20 Hostmessungen; bei 5k dated p50 3069.583 auf601.356ms, identische IO-Zähler. Keine Gerätemessung daraus ableiten.
- FLAC/Vorbis-Tags read-only; vorher echte Fixturetags übersehen, jetzt bounded/ranged geprüft.
- 12 unabhängige App-/Player-/Waveformfarben, persistente Preferences, physisch gemessener Listenviewport, keine leere Wechselnotice, 250ms/sofort/OS-ReduceMotion und revisionsgeschützter Palettecache.
- F25: vollständige Forge-/braces-Payloadhärtung und streng gebundener Auditgraph. Roh-Audit0critical/23high/5moderate; Issue396 und Frist21.10.2026 weiterhin offen.

Rootintegration: Typecheck und lint:ci0, Complexity4206 unverändertengegrenzt, gezielte Rootpakete156/34/45/22/54Tests grün (Überlappungen nicht als zusätzliche Tests zählen). Backup12-Accent-Roundtrip und SettingsCleanerroute gezielt geprüft.

## Aktueller Blocker / Folgedelta

CI38288668575 für e8c30d3: Securityaudit erfolgreich, Quality stoppt VOR Jest am Online-Expo-Check. Verlangt expo57.0.28, expo-dev-client57.0.20, jest-expo57.0.6. Genau diese3 direkten Patchstände und ihre14 Expo-Lockfileeinträge wurden aktualisiert. React19.2.3/RN0.86.3/RNTP5.12.1, NewArchitecture und RNTP-Nativpatch bleiben unverändert. Offline-Kompatibilitätscheck und frischeTypeprüfung0; definitiveOnlineprüfung erfolgt in folgenderCI. Auditgraph nur2 Versionsbindungen aktualisiert, alle übrigen Kanten/Nodes/Severities identisch; Payloadintegrität und Raw-Audit neu verifiziert. Kein Auditdeadline- oder Gate-Bypass.

V5-Treiber a8a145f45d088f2774b1a2d503e19b716953698d integriert:47PythonTests, 36Radios/ColdStart/beidePlayerlayouts, Auswahl/Anzeige-Cleaner/SAF-Syntheticdatei mit Audio/APIC/TPUB/WXXX/UnknownFrame-Erhalt. Androidausführung noch nicht bestätigt.

Original-Tracks.zip unabhängig read-only vollständig CRC-geprüft:21MP3, ID3v2.3, 13WXXX, 21APIC. Keine Originaldatei verändert oder Musikbyte im Repo veröffentlicht.

## Nächster Schritt

Neue vollständige CI für diesen abgeschlossenen SDK-/Harness-Folgecommit; fehlgeschlagene Gates gezielt beheben. Dann dieselbe exakt zugeordnete neueAPK öffentlich aufAndroid prüfen, Hash/Signatur/Quelle festhalten. Full-Scan- und Ideen-Dokumente mit endgültigen Resultaten aktualisieren und speichern. Keine ältereP1-APK als finaleV5 liefern.

## Wiederherstellbare Paketobjekte

Auswahl d2a3a74; Cleaner b765c5f; UI449955e; Scan91db509; Performance0eab324; Retryf04e827; F2508c3e074; FLACfb1550e; Harnessa8a145f. Diese IDs sind Quellencheckpoint-Referenzen; die Featureintegration ist e8c30d3. Keine abgeschlossenen V3/V4-Analysen wiederholen.

## Fortsetzung 13.10.2026 – fünf CI-Blocker behoben

Ausgangs-HEAD 332249f77dbc7768434019ccc27bc7d7f1920104; main geprüft unverändert auf b62b91b59c7400fd310a5db8fcbf9fc6444ff393. Saubere neue Arbeitskopie, keine erreichbaren anderen Git-Worktrees und keine aktiven GitHub-Runs. Alter Chat-/Workspacezustand nicht zugänglich. Ausgangsstand zusätzlich unter backup/codex-before-v5-resume-20261013-332249f gesichert.

- Alle fünf CI-Fehler lokal reproduziert: 5 fehlgeschlagene Tests / 235 Tests.
- Scan-Tests öffnen nun die standardmäßig eingeklappten Details; Cancel, bestätigte Titel und verspätete Veröffentlichungen bleiben geprüft.
- Ungültige Akzentwerte werden wirklich unbekannt gewählt; Lila-Speicherung/Provider-Neustart zusätzlich geprüft. Nur die zentrale Akzent-/Kontrastquelle in der Farbarchitektur freigegeben; übriges Farbverbot unverändert.
- storage.test.ts wartete nicht auf die vom vorherigen Test angeforderte optionale Wartung. Diese verbrauchte den einmaligen removeItem-Fehler. Wartung wird vor Testreset vollständig abgewickelt und der Speicherbesitz zurückgesetzt; keine produktive Fehlerunterdrückung ergänzt.
- Zusätzlich zwei reale Datenverlustregressionen zunächst rot nachgewiesen: fehlgeschlagene Enumeration verlor eine Legacy-Bibliothek; fehlgeschlagenes Chunk-Delete verlor die Rückfallkopie. Fix: Legacykey vor Wartung schützen, vor Löschung enumerieren, Chunkmanifest/Chunks/Legacy gemeinsam per Android-SQLite-multiRemove-Transaktion entfernen. Keine separate vorzeitige Rollbacklöschung. Fehler propagieren weiter. Epochwechsel und verzögerte native Löschung mit anschließendem Write extra geprüft.
- Gezielte ursprüngliche fünf + drei Speicherdateien: 8 Suiten / 278 Tests bestanden. Anschließende V5-Nachbarn einschließlich finaler vier neuer Löschtests: 11 Suiten / 84 Tests bestanden (Überlappungen nicht addieren).
- Typecheck, lint:ci und unveränderte Complexity-Grenzen (4206 Produktionsfunktionen) bestanden. Python-Harness: 47 Tests bestanden; dies ersetzt keine APK-Abnahme.

Nächster Schritt: vollständige CI mit Preview-APK auf diesem Paketcommit, anschließend öffentliche Android-UI auf exakt dieser geprüften APK. Security F25, Frist21.10.2026 und Hardwaregrenzen bleiben offen ausgewiesen; Originalmusik wurde nicht verändert.
