# V5 Scan, Persistenz und Statusoberfläche – 12.10.2026

Basis: `74af98a1d33a14e51aaa02598bcf9b5be0e48e25`. Kein Projektneustart; bestehende Quickscan-Flights bleiben unverändert.

## Behobener reproduzierter Hänger

Ein bereits bestätigter Bibliothekswrite wartete innerhalb der MutationQueue auf optionales `removeItem(legacy)`, `getAllKeys` und `multiRemove`. Drei deterministische Regressionen waren vorher rot, weil der Schreibabschluss trotz bestätigtem Manifest auf unendliche Wartung wartete. Der Write bestätigt jetzt nach verifizierten Chunks und dem nativen Manifest-ACK. Optionales Aufräumen koalesziert separat nach 1 s; laufende Reads/Writes bleiben geordnet.

Aktuelle Manifestkeys, in-flight Chunkkeys und gewünschte Legacy-Rückfallkopien sind geschützt. Die Wartung reserviert ungeschützte Keys atomar und löscht maximal 256 Keys pro Pass. Eine tatsächliche native Delete-Promise hält jeden Key bis zum echten Settlement; nur ein Write, der solche Keys wiederverwendet, wartet auf diese Löschung. Nach verzögerter Enumeration wird der aktuelle Schutz erneut geprüft. `removeLegacy:false` setzt seine Policy vor jedem Queue-/Deletionwait; ältere Cleanup-Pässe beachten die neueste Policy. Native Storage-Fehler bei Chunk/Manifestwrites bleiben Fehler, optionale Wartungsfehler werden beim nächsten Commit erneut versucht.

Scan/Metadatenrefresh/Batchwaveform-Activity und tatsächlich aktive oder detached native Waveformflights verschieben autonome Chunk- und Covermaintenance. Je Wartung existiert höchstens ein Wartetimer. Read-only Schedulerbeobachtung erhält Busy nach UI-Timeout bis zur tatsächlichen nativen Antwort. Coverleases bleiben bis zum Cleanupsettlement erhalten. Persistence-Flusher und tracked Promiseownership ermöglichen Backup und explizitem Libraryremove, tatsächliche IO abzuwarten. Ein abgelöster Persistenceepoch kann nach später Enumeration keine wiederhergestellten Keys/Covers löschen.

## Oberfläche

Laufender Scan: kompakter Spinner, Kurztext, optionale Details und Abbrechen mit 48-dp-Touchzielen. Keine zusätzliche laufende Zusammenfassung. Technische Statistik bleibt aufklappbar. Eine vollständig verarbeitete fehlerfreie Zusammenfassung ohne ungeprüfte Titel, Restbestand, Ordnerwarnung oder unbestätigte Speicherung verschwindet nach 4 s. Offene Details pausieren den Timer. Fehler, Teilergebnisse und unbestätigte Speicherung bleiben sichtbar; optionale Retrycallbacks sind für Controllerwiring vorgesehen. Eine Refresh-Cancelaktion lässt eine unabhängige Waveformanzeige samt eigener Cancelaktion verfügbar.

## Gemessener tatsächlicher JS-Quickscanpfad

`node scripts/benchmarks/quickScanPerformance.cjs --output docs/review/codex-v5-quickscan-host-profile-2026-10-12.json`

SAF discovery, Revisionentscheidung und begrenzte Fileworker werden tatsächlich ausgeführt. Pro Workload eine Aufwärmrunde und 20 Messrunden; nearest-rank p50/p95. Providergrenzen sind sofort antwortende Doubles. Gemessen wurde Host-Laufzeit inklusive der tatsächlichen Eventloop-Yields. Es gibt keine behauptete Verbesserung gegenüber einem hier nicht gemessenen vorherigen Build.

| Titel | sichere Provider-Dates | p50 (ms) | p95 (ms) | ungeprüft | Verzeichnis/Stat-Aufrufe |
| ---: | :---: | ---: | ---: | ---: | ---: |
| 10 | ja | 7.331 | 10.046 | 0 | 1/10 |
| 500 | ja | 308.849 | 502.718 | 0 | 1/500 |
| 2000 | ja | 1231.163 | 1472.129 | 0 | 1/2000 |
| 5000 | ja | 3069.583 | 3589.599 | 0 | 1/5000 |
| 10 | nein | 6.668 | 6.757 | 10 | 1/10 |
| 500 | nein | 300.177 | 322.500 | 500 | 1/500 |
| 2000 | nein | 1194.213 | 1239.891 | 2000 | 1/2000 |
| 5000 | nein | 3265.417 | 3670.862 | 5000 | 1/5000 |

Alle 160 gemessenen Durchläufe erfüllen den Quickscanvertrag: genau ein Directoryread, ein Providerstat pro Titel, 0 Audio-/Tag-/Cover-/Streamreads, 0 Coverwrites und 0 Checkpoints. Mit fehlenden zuverlässigen Providerdaten werden bekannte Titel als ungeprüft gezählt, niemals als sicher unverändert. Native Waveform- und Bibliotheksstorage sind in diesem unveränderten Quickscanlauf nicht aufgerufen und keine separat gemessene Gerätephase. Verzeichnis-/Providerlatenz, Android Frames/CPU/RAM, Samsung A50, tiefe/langsame SAF-Provider und APK-Verhalten sind damit **nicht** abgenommen.

Messdatei: `codex-v5-quickscan-host-profile-2026-10-12.json`, Node v22.23.3, aufgezeichnet 2026-10-12T13:03:25.873Z.

## Frische Prüfbelege

- 10 relevante Jest-Suites: 104 Tests erfolgreich, einschließlich Storagebudgets, Deletionraces, Coverlease-Handoff und UIwarnungen. Nach einem zusätzlichen Frühfehler-UI-Test, dem UI-Complexityrefactor und dem getrackten Libraryremove wurden die 6 geänderten Suites erneut erfolgreich geprüft (63 Tests; insgesamt 105 eindeutige Tests über beide Läufe).
- TypeScript: exit 0. Betroffene ESLint-Dateien: exit 0. Complexity: 3787 Produktionsfunktionen, exit 0; keine Baselineaufweichung.
- Rote Hängerregressionen sind vor der Implementation dokumentiert; anschließend grün. Kein Gerätetest und kein finaler APK-Erfolg aus Hosttests abgeleitet.
