# Waveform-Lifecycle: Gegenprüfung und Korrekturen vom 30.09.2026

Ausgangsstand: `codex`, `c3fcb83e2f811a8e9cd41739d6f27b35bd49d15c`.
Implementierung: `83c829aa40521f397d9562c9149e54b3edbf179b`.

## Bestätigte Ursachen und Umsetzung

1. **Dauer im Fingerprint:** AudioInfo-Backfill konnte dieselbe Audiodatei unter
   einem neuen Cache-/Flight-Schlüssel erscheinen lassen. Die neue Identität
   verwendet das bestehende v6-Null-Dauer-Layout. ID, Audio-URI, Größe und
   Importrevision bleiben Invalidierungsmerkmale; Daueränderungen nicht.
2. **Preloader-Neustart durch Metadaten:** Der Effekt hing vom gesamten
   `songs`-Array ab. Titel-, Cover- und Dauerupdates konnten deshalb den
   laufenden nativen Decoder abbrechen. Jetzt bestimmt die Identität der
   physischen Quellen den Lebenszyklus. Metadatenänderungen wecken ruhende
   Arbeit beziehungsweise merken einen weiteren Durchlauf vor. Deaktivierung,
   App-Hintergrund, Wiedergabestart und echte Quellenänderungen können weiterhin
   abbrechen.
3. **Synthetische Fallback-Daten:** Beide Playeransichten zeigten bereits anhand
   von `waveformReady` eine Mittellinie. Der Generator allein bewies deshalb
   keine sichtbare Fake-Form am Ausgangsstand. Erfundene Peaks sind jetzt auch
   aus dem Generator und der Normalisierung leerer Daten entfernt.

`getCachedWaveformForSong` übernimmt passende gespeicherte v6-Formen anhand
vollständiger alter Identitäten. Punkte, ermittelte Dauer und Erstellzeit bleiben
unverändert. Alte Einträge werden erst nach dauerhaftem Speichern von neuer
Form und Index entfernt. Ein Index-Schreibfehler erhält die alte Form auf Disk
und die sofort nutzbare neue Form im RAM.

Alle Cache-Konsumenten verwenden diese kompatible Auflösung. Auch gespeicherte
Vorbereitungsmarker werden übernommen, damit bereits vorbereitete Songs nach
Cache-Verdrängung weiterhin auswählbar bleiben. Nicht rekonstruierbare alte
Dauerwerte werden nicht erraten. Quelle, Größe oder Importrevision zu ändern
kann weiterhin eine neue Analyse erfordern.

Die Grenzen bleiben 80 RAM-/256 persistierte Formen sowie 20 Minuten für
spekulatives Bibliotheks-Preloading. Dieser Patch beschleunigt nicht den ersten
PCM-Decode selbst, sondern verhindert nachgewiesene unnötige Neustarts und
Cache-Misses. Die kleinere Waveform und das Kiwi-Ersatzcover bleiben erhalten.

## Audit

Der frische Production-Audit meldete am Ausgangsstand einen hohen
`brace-expansion`- und einen moderaten `fast-uri`-Befund. Ausschließlich die
bestehenden Overrides und zehn zugehörige Lockfile-Einträge wurden aktualisiert:

| Paketzweig | Vorher | Nachher |
| --- | --- | --- |
| brace-expansion 1.x | 1.1.18 | 1.1.21 |
| brace-expansion 2.x | 2.1.4 | 2.1.7 |
| brace-expansion 5.x | 5.0.9 | 5.0.12 |
| fast-uri 3.x | 3.1.7 | 3.1.8 |

Quellen: [Brace-Expansion-Parsing](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr),
[Brace-Expansion-Rekursion](https://github.com/advisories/GHSA-qhr7-859c-m2p7),
[Fast-URI-Normalisierung](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj).
Der erneute Audit meldet **0 Vulnerabilities**; die unveränderte Audit-Policy
besteht ohne Ausnahmen. Expo/RN/RNTP wurden nicht migriert, `newArchEnabled=false`
und der RNTP-Postinstall-Patch bleiben erhalten.

## Frische Prüfung nach Wiederherstellung

Die unterbrochene Arbeitsumgebung wurde ersetzt, bevor die Änderungen auf dem
Branch gesichert waren. Implementierung und Regressionstests wurden anhand des
Protokolls wiederhergestellt. Folgende Ergebnisse stammen aus dem neuen Lauf:

- **3.155 Tests / 324 Suites mit Coverage bestanden.**
- TypeScript, ESLint ohne Warnungen, Complexity- und NUL-Byte-Gate bestanden.
- 13 Python-Tests der Android-Diagnostik bestanden.
- Expo-Dependency-Check bestanden; der Versionsendpoint war nicht erreichbar,
  deshalb verwendete Expo seine mitgelieferte Kompatibilitätsliste.
- Expo-Release-Konfiguration und generierter Android-Manifest-Gate bestanden.
- Der Android-Prebuild lief wie die CI mit Node 20. Im vorherigen Versuch hatte
  Node 24 beim wiederholten Prebuild leere generierte Cache-Bilder hinterlassen;
  unter Node 20 bestanden auch wiederholte Prebuilds. Keine Quellbilder geändert.

Die 20 zusätzlichen Testfälle decken neutrale Daten, Dauer-Backfill während und
nach Analyse, persistierte Wiederverwendung nach Neustart, v6-Migration,
Speicherfehler, Hash-Kollisionen, Quellenwechsel, Vorbereitungsmarker und den
Preloader mit aktivierter nativer Cancellation ab.

Die native Kotlin-Kompilierung und Android-Unit-Tests laufen anschließend in der
unveränderten GitHub-CI des neuen `codex`-Standes. Lokale Jest-Mocks sind dafür
kein Ersatz. Die CI erstellt keine APK.

## Offene Laufzeitprüfung

Kein neuer Hardware-Smoke-Test oder A50-Benchmark wurde durchgeführt. Limruns
installierbare Apps enthalten derzeit nur Expo-Go-Images; diese reichen für
RNTP und `expo-system-audio` nicht aus. Für einen Test ist eine passende native
APK erforderlich. Der erneute Limrun-CLI-Aufruf meldete fehlende Authentifizierung
(`Not authenticated`), sodass auch kein Remote-Build gestartet werden konnte.
CodeRabbit wurde nicht ausgeführt; die CLI-Anmeldung war im
vorherigen Versuch nicht verfügbar.

Auf dem A50 bleiben Cold-Analyse, Cache-Hit nach Neustart, Trackwechsel,
Hintergrund-/Sperrbildschirm-Wiedergabe, Interruptions, Queue-Reorder,
SAF/MediaStore, MP3/M4A-Tagwrites samt Recovery und längere Wiedergabe mit
Speichermessung offen. Vorhandene `[WaveformTiming]`-Logs unterscheiden Analyse-,
Cache- und Player-Auflösungszeiten.
