# Auftrag 2, A2 – Scan-Statistik vom 08.10.2026

Ausgangspunkt ist `codex` bei
`3f44c6898d23d9c2d835ef255e31ff78c3a83a22`, gesichert als
`a2-statistics-start-20261008`. Die vorherige APK und ihre CI sind abgeschlossen:
[CI 37751533754](https://github.com/k1w1-a0style/musik-player/actions/runs/37751533754).
Diese Fortsetzung behandelt die noch fehlende sichtbare Statistik. Sie ist kein
Abschluss aller drei Arbeitsaufträge.

## Befunde und Umsetzung

Die Scanner lieferten Wiederverwendung und ungeprüfte Revisionen, aber keine
vollständige sichtbare Aufteilung. Ein vollständiger Scan analysiert auch
unveränderte Quellen erneut; die Zahl importierter Ergebnisse wäre deshalb
kein korrekter Zähler für geänderte Dateien.

Zusätzlich saß das bisherige `progress.finish()` im `finally` des rohen Lesers.
Ein dauerhaft hängender Provider konnte nach seinem wirksamen Dateitimeout
weiter als aktiver Titel erscheinen. Der Abschluss gehört jetzt zum
Worker-Ergebnis beziehungsweise zur behandelten Worker-Fehlermeldung. Der
native Leseplatz bleibt trotzdem bis zum tatsächlichen Settlement reserviert.
Verspätete Antworten publizieren weder Titel noch Zähler nachträglich.

| Anzeige | Zählregel |
| --- | --- |
| Neu | Erfolgreich verarbeitete Quelle ohne bisherigen Bibliothekseintrag. |
| Geändert | Erfolgreich verarbeitete bekannte Quelle mit belegter Änderung. |
| Unverändert | Erfolgreiche Wiederverwendung mit passender Revision; im Full Scan ist ein verifizierbarer Inhaltsvergleich erforderlich. |
| Ungeprüft | Bekannte Revision nicht sicher vergleichbar oder Inhaltsprüfung im Full Scan nicht möglich. |
| Leseprobleme | Vom Import gemeldete Verzeichnis-, Datei-, Timeout- oder Songbauprobleme; SAF-Quellen werden normalisiert und nicht doppelt als Fehler gezählt. |

Ein Full Scan kann einen neuen/geänderten Titel übernehmen, obwohl seine
Inhaltsprüfung scheitert. Dann überschneidet sich „Ungeprüft“ mit diesem
Zähler; die Anzeige erklärt das. Fehlende Tags allein sind kein Lesefehler.
Mehrfach gefundene Quellen werden intern separat gezählt und erhöhen weder
„Neu“ noch „Unverändert“ erneut. Die Werte beschreiben Dateiverarbeitung,
nicht die Anzahl bereits vollständig gespeicherter Checkpoints.

Das Menü nennt Schnellscan und vollständigen Scan ausdrücklich und erklärt
den Unterschied. Die Statistik erscheint während der Verarbeitung sowie
nach Abschluss, Teilabschluss, Fehler oder Abbruch. Das Ergebnis kann danach
geschlossen werden. Ein neuer Scan ersetzt es. Unbekannte Revisionen werden
nicht als unverändert ausgegeben; eine ungesicherte Restzeit wird nicht gezeigt.

Jeder Scan erhält eine eindeutige Operations-ID. Alle Dateiwerte werden intern
erfasst; die vorhandene UI-Publikation begrenzt Benachrichtigungen weiterhin
auf ihre bisherigen Batch-/650-ms-Grenzen. Abbruch übernimmt den neuesten
internen Stand sofort. Ein alter Callback, Abschluss oder Fehler kann das
Ergebnis eines neueren Scans nicht überschreiben. Eine laufende separate
Metadatenaktualisierung erhält ihre eigene Anzeige.

## Prüfungen und Grenzen

Vier neue Scanner-Regressionen scheiterten am Ausgangsstand wegen der fehlenden
Statistik. Mit dem Fix bestehen sie für SAF und Medienbibliothek: gemischte
Ergebnisse, Timeout vor Settlement, keine verspätete Publikation, Inhaltsvergleich
im Full Scan und überlappende SAF-Grants. Zwei weitere Tests prüfen fehlende
Full-Hash-Unterstützung und einen Verzeichnisfehler ohne gefundene Dateien.

Fünf UI-Tests prüfen sichtbare Ergebnisse, das letzte intern gepufferte Ergebnis
bei Abbruch, Generationenwechsel, Teilabschluss, fehlende Bestätigung/Berechtigung,
Fehler und die Trennung zur Metadatenaktualisierung. Der bestehende echte
Bildschirm-Abbruchtest prüft jetzt zusätzlich die Zähler nach Abbruch und nach
einem verspäteten Callback. Controller und Song-State sind echt; die nativen
Provider-/Storage-Grenzen verwenden Doubles.

Die erste vollständige lokale Prüfung unter Node 22.23.3 umfasst 363 Suites /
3604 Tests. Dabei bestehen 361 Suites / 3601 Tests; drei Testaufbauten müssen
angepasst werden: ein alter Menütext und der fehlende Theme-Kontext in zwei
isolierten Layouttests. Nach diesen Korrekturen bestehen alle 39 Tests der
sechs gezielt erneut geprüften Suites. Keine Assertion, Coverage-Grenze oder
Complexity-Ausnahme wird abgeschaltet. Der abschließende vollständige Lauf
besteht mit **363 Suites / 3604 Tests**, Exit 0, in 115,139 s. Coverage:
Statements 93,35 %, Branches 85,28 %, Functions 94,99 %, Lines 95,82 %.
Typecheck, ESLint ohne Warnungen, Complexity (3395 Produktionsfunktionen) und
Source-NUL (945 Textquellen) bestehen. Die abschließende kombinierte Prüfung
enthält alle korrigierten Testaufbauten und den unveränderten finalen Produktionscode.

Die CI des enthaltenden Commits prüft zusätzlich Security, Online-Expo-
Kompatibilität, Konfiguration, Hermes/Permissions, Release-Kompilierung, beide
nativen Testsuiten und APK-Identität. Die dazugehörige APK wird erst nach
erfolgreicher CI und Prüfung ihrer Herkunft ausgeliefert. Das ersetzt weder
einen Android-Starttest noch eine Prüfung auf dem A50.

## Schnellscan mit 500 / 2.000 / 5.000 Titeln

Die reale JS-Discovery, Revisionsermittlung, Auswahl und Worker laufen gegen
sofortige Provider-Doubles. Ein Aufwärmlauf und drei Messläufe je Größe und
Datumsvariante prüfen die unveränderte Auswahl und die neuen Zähler.

| Titel | Host-Median vorher → nachher, mit Datum | Stat-Aufrufe | Stream-/Tag-/Audio-/Cover-/Checkpoint-Aufrufe |
| --- | ---: | ---: | ---: |
| 500 | 317,340 → 304,378 ms | 500 → 500 | 0 → 0 |
| 2.000 | 1275,500 → 1183,955 ms | 2.000 → 2.000 | 0 → 0 |
| 5.000 | 2968,358 → 2972,662 ms | 5.000 → 5.000 | 0 → 0 |

Mit Datum melden die neuen Zähler exakt N unveränderte Quellen. Ohne Datum
melden sie exakt N ungeprüfte Quellen und **null** unveränderte. In allen sechs
Workloads bleiben neue/geänderte Quellen, Fehler und weitere Analyseaufrufe
bei null. Es wird keine Beschleunigung behauptet: JS-Yields/Timer und nicht
normalisierte Host-Prüflast beeinflussen diese Zeiten. Sie messen keine echte
Providerlatenz, Android-RAM-Spitze oder Scroll-Jank.

Rohdaten: [Vorher](./auftrag-2-a2-statistics-quick-before.json) und
[Nachher](./auftrag-2-a2-statistics-quick-after.json).

```sh
node scripts/benchmarks/quickScanPerformance.cjs --revision 3f44c6898d23d9c2d835ef255e31ff78c3a83a22 --output docs/review/auftrag-2-a2-statistics-quick-before.json
node scripts/benchmarks/quickScanPerformance.cjs --output docs/review/auftrag-2-a2-statistics-quick-after.json
```

## Offene Arbeit

A2: gemessener nativer Ordnercursor-/Provider-Vergleich und echte Gerätetests
für Quick/Full, Abbruch und langsame/Cloud-SAF-Anbieter. Eine neue Cursor-
Implementierung benötigt den im Auftrag verlangten Nutzenbeleg. A4–A8,
Playlist-Dateien, weitere Funktionen und Audiointegrationen sowie Auftrag 3
bleiben nachgelagert. Die beiden bekannten Security-Ausnahmen werden in diesem
Abschnitt nicht erweitert; das Security-Gate bleibt verpflichtend.
