# Auftrag 2: Waveform und Progress, erster Performance-Abschnitt

Ausgangsbasis: `dad2af1d087f407b888390aa3f9f59e5f1f4b641`. Dieser Abschnitt erfüllt A3. Scan, SQLite, Artwork und Funktionen werden getrennt integriert; ihre aktuellen Arbeitsstände sind kein Bestandteil dieses Commits.

## Verhalten

- Deaktivierte Hintergrundvorbereitung besucht keine Song-Zeile und erzeugt keine globale JSON-/Sortiersignatur. Ein inkrementeller Index unterscheidet Audioquellen von Änderungen an Titel/Interpret. Gleiche unveränderte Arrays benötigen keinen neuen Durchlauf.
- Aktive Decoder behalten Vorrang. Veraltete Foreground-/Idle-Arbeit wird bei Quellenwechsel verworfen; Hintergrundarbeit startet erst nach Interaktionen und einer Ruhefrist. Bestehende Decoder-/Schedulergrenzen bleiben erhalten.
- Positive Dateiänderungszeit und vorhandener Content-Hash gehören zur physischen Quellenrevision. Gleiche URI/Größe mit neuer Revision kann keine alten Peaks verwenden. Ohne solche Daten bleiben die bisherigen v6-Schlüssel kompatibel; ein revisionierter Track fällt niemals auf einen unrevisionierten Cache zurück.
- Wiederholte Veröffentlichung identischer Cacheeinträge schreibt das Manifest nicht erneut. Cacheverfügbarkeit nutzt eine Map statt linearer Suche. Bestehende Disk-/RAM-Budgets und Cleanup bleiben erhalten.
- Cover-Puls verwendet den zentralen Progress-Provider. Ein zusätzlicher `useProgress`-Poll entfällt; bestehende Fortschrittsinterpolation und Ein-/Aus-Einstellung bleiben erhalten.

## Messung

Reproduzierbarer Harness: `scripts/benchmarks/waveformPerformance.cjs`. Vorher-/Nachher-JSONs liegen daneben im Review-Verzeichnis. Beide Läufe verwenden Node 22.23.3 und dieselben 180-Sekunden-Fixtures mit 1024 Peaks und 3600 Bass-Buckets. Dateisystem/AsyncStorage und React-Effekte sind an ihren Grenzen isoliert; dies misst reine Host-JS-Arbeit und Serialisierungsvolumen, keine Android-Latenz oder echten Gerätespeicher.

| Prüfpunkt | Vorher | Nachher |
| --- | ---: | ---: |
| Besuchte Songs pro deaktiviertem Render, 500 / 2000 / 5000 | 500 / 2000 / 5000 | 0 / 0 / 0 |
| Reine deaktivierte Hook-Arbeit bei 5000 Songs, Median | 3,0786 ms | 0,0006 ms |
| 10 identische Publikationen, Manifest-Writes | 10 | 0 |
| Dabei übertragene Manifestbytes | 2.755.270 | 0 |
| Dabei erneut gelesene Payload-Dateien | 10 | 0 |
| 10.000 Verfügbarkeitsabfragen bei 1000 Einträgen, Median | 14,2076 ms | 0,5709 ms |

1000 Waveforms belegen im Nachher-Fixture 23.293.456 serialisierte Payloadbytes und 275.526 Manifestbytes. Zwei aktive RAM-Einträge werden mit 75.008 Datenbytes gezählt; diese interne Budgetzählung ist keine Prozess-RAM-Messung. Änderungen am Manifestformat erklären die kleinen Bytedifferenzen zum Vorherlauf.

Vergleich wiederholen:

```sh
node scripts/benchmarks/waveformPerformance.cjs --revision dad2af1d --output docs/review/auftrag-2-waveform-before.json
node scripts/benchmarks/waveformPerformance.cjs --output docs/review/auftrag-2-waveform-after.json
```

## Nachweise und Grenzen

Der fokussierte Waveform-/Progress-/Cover-Block besteht frisch mit 26 Suites und 263 Tests. Neue Revisionsregressionen scheiterten vor der Korrektur. Getestet werden auch Cachetreffer, schnelle Quellenwechsel, verspätete native Ergebnisse, Foreground-/Idle-Lifecycle und Puls an/aus. Der bestehende SAF-Importtest berücksichtigt die einmalige sichere Cacheinvalidierung, wenn eine bislang unbekannte physische Revision verfügbar wird; der unveränderte Folgescan liest weiterhin keine Audiodaten.

Der isolierte vollständige Abschnittsstand besteht frisch mit **353 Suites / 3524 Tests**, einschließlich aller Coverage-Grenzen. TypeScript 6, ESLint ohne Warnungen und das Complexity-Gate über 3306 Produktionsfunktionen sind ebenfalls erfolgreich. Die Prüfung verwendet genau den staged Git-Tree auf der Ausgangsbasis; parallele SQLite-/Artwork-Arbeit ist nicht enthalten. Der veröffentlichte Commit erhält zusätzlich die regulären Projekt-/Native-Gates.

Echte Samsung-A50-Werte für Trackwechsel, RAM und Scroll-Jank sowie sichtbare Pulsierung auf Hardware stehen weiter aus. Die Hostmessungen und Componenttests ersetzen diese Prüfung nicht. Optikänderungen aus Auftrag 3 bleiben nachgelagert.
