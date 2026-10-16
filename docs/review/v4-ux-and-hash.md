# Phase 6 – F07/F08/F11

Stand: 16.10.2026. Gezielte produktive Änderungen; neue APK-Abnahme erforderlich.

## F07 – SAF-Hashkosten: begrenzt, Provider-Nachweis extern offen

Die unveränderte tatsächliche TypeScript-Implementierung wurde mit einem explizit injizierten synthetischen Host-Adapter für 10/25/50 MiB ausgeführt. `node scripts/bench/cleanerHashHost.cjs` führt keine Musikdatei-Mutation aus. [Messdaten](evidence/v4-cleaner-hash-host.json).

| Größe | Range-Reads | Stat-Reads | Max. Range | Host-Laufzeit | Host-CPU |
|---|---:|---:|---:|---:|---:|
| 10 MiB | 160 | 2 | 64 KiB | 727 ms | 669 ms |
| 25 MiB | 400 | 2 | 64 KiB | 1.655 ms | 1.374 ms |
| 50 MiB | 800 | 2 | 64 KiB | 3.082 ms | 2.416 ms |

Alle drei Hashes entsprechen einer unabhängigen Node-SHA256-Berechnung. Abgetasteter Host-Heap lag bei ca. 32 MB; dies ist weder Android-PSS noch eine pro Fall isolierte Speicherallokation. Die gemessene Host-Timer-Verzögerung ist kein UI-Frame-/Jank-Nachweis. Hermes, Bridge, Cloud-/OEM-Provider, reale CPU/RAM und Android-Frames fehlen weiterhin. Ohne diese Messung wurde keine vermeintliche Optimierung eingebaut; Range-Grenze, vollständiger SHA, Revisionsprüfung, TOCTOU- und No-write-Grenzen bleiben unverändert. Der echte Provider-Benchmark bleibt extern blockiert (F06).

## F08 – SoundCloud-Infochip

Bestätigte Ursache: Metadatencontainer mit fester Höhe 126 und `overflow: hidden`, kombiniert mit einer nur 34 dp hohen Aktion und unbeschränktem Text in einer horizontalen Zeile.

Korrektur: natürliche Metadatenhöhe bei gleicher Mindesthöhe und ohne Abschneiden; kein Schrumpfen des Metadatenblocks. Die Aktion hat mindestens 48×48 dp, darf die volle verfügbare Breite verwenden und ihr unverkleinerter, weiter skalierender Text darf umbrechen. Schriftgröße, Textinhalt, Waveform- und Carousel-Gesten bleiben erhalten.

Ein gezielter Komponententest prüft diese Layout-Verträge und die echte Info-Aktion. Die neue Android-Abnahme prüft vor den aufwendigen Reststufen bei 100/130/150/200 % zwei stabile native XML-Geometrien, mindestens 48 dp, keine Überschneidung mit den Transportkontrollen, Screenshots und tatsächliche Navigation zur TrackInfo. Negative Geometrietests lehnen abgeschnittene, zu kleine, deaktivierte, fremde und überlappende Aktionen ab. Screenshots werden abschließend separat kritisch gesichtet; Host-Styles sind keine Pixel-Abnahme.

## F11 – fehlende Quellen im Backup

Neu exportierte fehlende Referenzen erhalten den Titel „Fehlende Quelle“; ihre unveränderte ursprüngliche ID bleibt das Verknüpfungsmerkmal. Vorschau, Accessibility-Label und manueller Picker zeigen „Fehlende Quelle · ehemalige ID: …“. Auch alte Version-1-Platzhalter `title === id` werden rein für die Darstellung verständlich beschriftet.

Das Backup-Format bleibt Version 1 ohne neue Pflichtfelder. Identitäts-, Hash-, Revisions- und Konfliktprüfung sind unverändert. Keine Titelheuristik für automatische Zuordnung, kein stilles Weglassen von IDs, keine Mutation des eingelesenen Backups. Die manuelle Zuordnung arbeitet weiterhin mit den ursprünglichen IDs und bleibt ausdrücklich erforderlich.

## Regressionen

Die neuen UI-/Backup-Regressionen wurden vor der Korrektur rot nachgewiesen. Danach 64/64 Tests in sieben gezielten Suiten grün, einschließlich Carousel/Gesten, Backup-Transaktion und konservativem Mapping. Hinzu kommen die Python-Treiber-/Geometrietests, Typecheck, betroffene ESLint-Dateien und das unveränderte Komplexitäts-Gate. Die nachträglich ergänzte Cleaner-Guard-Testzeile erhielt dabei eine TypeScript-Verengung für die Mock-Implementierung; keine produktive Cleaner-Änderung und keine gelockerte Assertion.
