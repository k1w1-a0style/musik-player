# V5 Quickscan – budgetierte Eventloop-Yields, 12.10.2026

Weiterführender, separater Performance-Slice nach dem getesteten Scan-/Persistenz-/UI-Paket. Kein Umbau der bestehenden Quickscan-Flights oder nativen Filebudgets.

## Messbefund und Änderung

Nach jedem Providerstat wurde ein `setTimeout(0)` abgewartet, auch wenn der Titel sicher unverändert oder mangels zuverlässiger Providerdaten ungeprüft wiederverwendet wurde. Der Solltest für 128 wiederverwendete Titel schlug vorher mit 134 SAF- bzw. 128 MediaStore-Frame-Timern fehl (Soll: weniger als 32).

Nur wiederverwendete/duplizierte Quellen teilen jetzt je Import einen Frame-Budgeter: Yield spätestens nach 16 Ergebnissen oder 8 ms verstrichener Arbeit. Die bereits vorhandenen beiden Fileworker teilen einen einzigen ausstehenden Frametimeout. Abbruchchecks bleiben vor/nach Revisionlesen und Framewarten vorhanden. Neue/geänderte Dateien und Vollscan-Metadatapfade behalten ihre vorherige einzelne Eventloop-Unterbrechung. Keine zusätzlichen parallelen Providerzugriffe; bestehende zwei tatsächliche native Reservations und deren Timeoutownership bleiben unverändert.

Eine Revisionänderung wird vor dem neuen gemeinsamen Await dem jeweiligen Fileworker zugeordnet. So kann der andere Worker während einer Framepause keine fremde Bibliotheksrevision in dessen Checkpoint einschleusen.

## Identische Hostworkloads vorher/nachher

Beide Profile: 8 Workloads, je 20 Messungen nach einer Aufwärmrunde, Node v22.23.3, nearest-rank p50/p95. Tatsächliche SAF discovery, Revisionentscheidung und Worker laufen; Providergrenzen antworten sofort. Alle IOcounters und Ergebnisstatistiken stimmen vor/nachher exakt überein: Directory 1, Providerstat N, Audio/Tags/Cover/Stream/Checkpoints 0. Ohne sichere Provider-Dates sind N Titel ungeprüft und 0 sicher unverändert.

| Titel | sichere Provider-Dates | vorher p50/p95 (ms) | nachher p50/p95 (ms) |
| ---: | :---: | ---: | ---: |
| 10 | ja | 7.331/10.046 | 1.524/2.057 |
| 500 | ja | 308.849/502.718 | 62.160/66.281 |
| 2000 | ja | 1231.163/1472.129 | 241.750/255.338 |
| 5000 | ja | 3069.583/3589.599 | 601.356/614.396 |
| 10 | nein | 6.668/6.757 | 1.203/1.245 |
| 500 | nein | 300.177/322.500 | 60.681/61.787 |
| 2000 | nein | 1194.213/1239.891 | 240.420/245.189 |
| 5000 | nein | 3265.417/3670.862 | 600.730/609.167 |

Hostzeiten zeigen hier weniger Timer-/Eventloopwartezeit bei identischer Arbeit. Das ist kein Android-/A50-Speedupbeleg: physische Providerlatenz, UIframes, native Dateisystem-/Storage-/Waveformlaufzeiten und RAM/CPU wurden nicht gemessen. Die Messungen entstanden während anderer Hostprüfungen; keine kontrollierte Gerätebenchmarkserie oder APK-Abnahme.

Vorher: `codex-v5-quickscan-host-profile-2026-10-12.json` (2026-10-12T13:03:25.873Z). Nachher: `codex-v5-quickscan-budgeted-yield-host-profile-2026-10-12.json` (2026-10-12T17:43:48.909Z).

## Prüfbelege

- Vorher zwei reproduzierbar rote Integrationstests für die Frame-Timerzahl.
- Nachher 10 relevante Import-/Budget-Suites, 157 Tests grün. Zusätzlich zwei neue Checkpoint-Frame-Racefälle im gezielten Yield-Suite geprüft (9/9 Tests).
- TypeScript, betroffene ESLint-Dateien und Complexity-Gate (3791 Produktionsfunktionen) erfolgreich. Keine Baselineaufweichung.
- Die Hostbenchmarkserie endet erfolgreich; alle 160 Nachherläufe erfüllen die unveränderten Quickscan-/IO-/Statistikverträge.
