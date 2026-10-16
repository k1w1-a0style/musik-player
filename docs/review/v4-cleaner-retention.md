# F03 – bestätigte Cleaner-Journal-Retention

Stand: 16.10.2026. Produktänderung gegenüber der unveränderten V5-APK.

## Ursache und Korrektur

Das Hauptjournal wurde ersetzt, die inkrementellen Eintrags-Keys älterer Läufe blieben dauerhaft liegen. Vor dem Wechsel der Epoche wird jetzt der vollständig gelesene alte Zustand unter einem eigenen, zurückgelesenen Retention-Key gesichert. Nur abgeschlossene `displayed`/`written`/`skipped`-Einträge dürfen gesammelt werden; native Ergebnisse erfordern zusätzlich `terminal`, `completed`, kein `recoveryPending` und einen bestätigten Schreib-/No-op-Erfolg. Fehler, geplante, offene oder unterbrochene Einträge bleiben erhalten.

Löschen geschieht in Paketen von höchstens 100 abgeleiteten Eintrags-Keys. Jedes Paket wird anschließend vollständig auf Abwesenheit geprüft. Der Retention-Beleg wird erst danach gelöscht und ebenfalls kontrolliert. Ein Abbruch lässt den Beleg zur Wiederaufnahme bestehen. Speicher-, Parse-, Zuordnungs- und Rücklesefehler werden weitergereicht; es gibt keine automatische Wiederholung einer Musikdatei-Mutation.

Lese-, Journal- und Eintragsoperationen sind gemeinsam serialisiert. Die Epoche wird innerhalb dieser Reihenfolge geprüft. Ein bereits eingereihter alter Writer kann daher keine abgelöste Epoche wiederbeleben. Der bestehende Batch-Guard bleibt während ausstehender Speicherarbeit aktiv.

## Bewusste Sicherheitsgrenze

Verwaiste Legacy-Keys ohne belegbaren Abschluss werden nicht anhand ihres Namens gelöscht. Auch offene alte Epochen und native Recovery-Daten werden nicht durch eine Altersgrenze entfernt. Ihre Anzahl kann weiterhin wachsen, solange deren Fälle nicht fachlich geklärt sind. Das ist beabsichtigte Beweiserhaltung; die neue Retention begrenzt abgeschlossene zukünftige Läufe. Keine Original-Musikdatei wird durch diese Wartung geöffnet oder verändert.

## Gezielte Nachweise

- Neue Speicherregressionen zunächst gegen den alten Code rot: 11/11 fehlgeschlagen; insbesondere 24 Läufe, offene Epochen, native Pending-Evidenz, Löschfehler und eingereihte alte Writer.
- 82/82 Tests in drei grünen Suiten umfassen Journal, Batch-Ausführung und native Startup-Recovery; zusätzlich Test des aktiven Guards bei absichtlich angehaltener Löschung.
- Größen-/Zuordnungsfehler, unbestätigte Löschung, Wiederaufnahme nach Fehler, Wiederverwendung einer offenen Epoch-ID und Erhaltung fremder/Legacy-Recovery-Keys sind explizit abgedeckt.
- Typecheck, betroffene ESLint-Dateien und bestehendes Komplexitäts-Gate werden ohne gelockerte Grenzwerte geprüft.

Die vollständige neue APK-Abnahme folgt nach Integration der übrigen produktiven V4-Korrekturen. Die historischen V5-Nachweise sind keine Abnahme dieser Änderung.
