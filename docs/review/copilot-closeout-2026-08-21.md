# Kritischer Abschluss des Copilot-PDF-Reviews

Stand: 2026-08-22
Vergleichsbasis: `codex` bei `f27e4cbc9b18cb5a97923acbc81be294aab44b13` plus Startup-PR

## Ergebnis

Die elfseitige Copilot-Unterlage wurde nicht als ungeprüfte Aufgabenliste übernommen, sondern gegen den aktuellen Quellcode, die bereits gemergten Player-/Waveform-PRs und die automatischen Gates abgeglichen. Die reproduzierbaren Codeprobleme sind behoben. Mehrere vorgeschlagene Änderungen wären wirkungslos oder regressionsgefährlich und bleiben daher bewusst aus. Offen sind nur Prüfungen, die echte Android-Hardware, einen neuen Development Build oder eine separate Produkt-/Lizenzentscheidung erfordern.

## Abgleich der Befunde

| Aussage/Empfehlung aus dem PDF | Kritisches Ergebnis im aktuellen Stand | Entscheidung |
| --- | --- | --- |
| Bibliothekssortierung memo-isieren | `useLibraryController` memoisiert `sortLibrarySongs(songs, sortMode)` bereits; Suche nutzt `useDeferredValue`, Song-Suchtexte sind gecacht und Listen virtualisiert. | Erledigt; kein Worker ohne gemessenen Geräteengpass. |
| Palette-LRU mit 50 Einträgen und 30-Minuten-TTL | `albumPaletteHelpers` besitzt bereits einen begrenzten LRU, Single-Flight/Latest-Wins-Scheduling und Timeouts. Eine willkürliche TTL würde unveränderte Cover erneut decodieren. | Bestehende belastbare Lösung behalten. |
| Waveform-Cache pauschal von 80 auf 200 erhöhen | Der Cache ist persistent, versioniert, fingerprint-gebunden, LRU-begrenzt und kann Index-/Payload-Korruption rekonstruieren. Aktueller und benachbarte Titel werden priorisiert vorgewärmt. Ein höheres Limit erhöht Storage/RAM ohne belegten Nutzen. | 80 bleibt bewusst bestehen. |
| Beide Player mit 320 Punkten extrahieren | Beide Ansichten verwenden eine kanonische Native-Waveform mit 160 Punkten. Darstellung wird memoisiert angepasst; dadurch gibt es keine doppelten Extraktionen. Die native Extraktion sampelt lange Titel über die gesamte Dauer. | 160 ist die gemeinsame Performance-/Detailentscheidung. |
| Timeout 25 s auf 12 s und Backoff 30 s auf 15 s senken | Kürzere Grenzen erzeugen auf langsamen Providern häufiger synthetische/grobe Fallbacks und wiederholen teure Decoderarbeit früher. Die eigentliche Hängerursache wurde durch begrenzte Flights, Cancellation, Prioritäten und Safe Preloading behoben. | Nicht übernommen. |
| Previous/Current/Next preloaden | Der aktuelle Titel hat Foreground-Priorität; der wahrscheinliche nächste Titel wird als `preload`, der vorherige als `background` eingeplant. Cancellation stellt die höchste verbleibende Waiter-Priorität wieder her. | Erledigt in #384/#385. |
| `normalizeWaveformPoints` nicht pro Render ausführen | Die Auswahl/Normalisierung liegt in `useMemo`; SoundCloud normalisiert ebenfalls memoisiert. | Erledigt. |
| Waveform nach Tag-Edit invalidieren | Der TagWriter verändert Metadaten, nicht den Audio-Sample-Stream. Eine erneute PCM-Extraktion wäre unnötig; Cover/Tags werden separat reread-verifiziert. Cache-Version und Source-Fingerprint schützen Struktur und Quellenidentität. | Bewusst nicht umgesetzt. |
| Progress auf 250 ms oder Display-Refresh-Rate erhöhen | 500 ms ist absichtlich zwischen Provider und SoundCloud-Projektion synchronisiert. Waveform/Scrubbing bewegen sich über native Animated-Werte; 60/120 Abfragen pro Sekunde würden JS-/Bridge-Arbeit und Akkuverbrauch erhöhen. | 500 ms bleibt. |
| Context-Split sei wirkungslos | Library-, Mini-Player- und Now-Playing-Werte werden separat memoisiert. Mini-Player-Fortschritt sitzt in einem kleinen memoisierten Kind statt im breiten Music-Context. | PDF-Befund widerlegt. |
| `useLibraryController` aufteilen | Der Controller delegiert bereits an spezialisierte State-, Action-, Renderer-, ViewModel-, Sort-, Import- und Refresh-Hooks. Der Komplexitäts-Gate verhindert unkontrolliertes Wachstum. | Kein weiterer Blind-Refactor. |
| Tag-Write-Rollback sei nicht getestet | JS-Orchestrierung, Recovery-Journale, atomare Evidence-Persistenz, Rollback/Fallback und native Kotlin-Transaktionen besitzen umfangreiche Regressionstests. | Erledigt. |
| SAF-Grant beim Ordner-Cleanup immer freigeben | Importierte `content://`-Titel benötigen den persistierten Tree-Grant weiterhin für Wiedergabe, Refresh und Tag-Edit. Ein automatisches Release beim Entfernen eines Scan-Ordners würde bestehende Bibliothekstitel brechen. | Nur mit einer späteren expliziten „Ordner und Zugriff vollständig entfernen“-Produktsemantik ändern. |
| SAF-URIs könnten in Logs leaken | Native Logs verwenden `safeLogReference`/`safeLogType`; Cover-Cleanup loggt nur eine normalisierte Reason und keine URI. | Erledigt. |
| New Architecture aktivieren | `react-native-track-player@4.1.2` bleibt der dokumentierte Blocker und die Repo-Regel verlangt `newArchEnabled=false`. | Separater TrackPlayer-/Lizenz-/NewArch-PR erforderlich. |
| App-Start/Hydration | Tag-Recovery und vollständige native Player-Hydration blockierten den sichtbaren Start; sekundäre Screens wurden früh ausgewertet. | Dieser Startup-PR trennt UI- und Native-Readiness, parallelisiert Storage/Player, verschiebt Backfills, lazy-evaluiert Screens und protokolliert Phasen. |

## Verbleibende externe Nachweise

Diese Punkte sind keine offenen Code-Fixes und dürfen nicht durch Unit-Tests oder Schätzwerte als erledigt ausgegeben werden:

1. Neuer Android Development Build, weil der Startup-PR den nativen Recovery-Status erweitert.
2. Cold-/Warm-Startmessung sowie Waveform-, Swipe-, Scrub-, Queue- und Cover-Profiling auf 60-Hz- und 120-Hz-Geräten.
3. SAF-Smoke mit realen Providern einschließlich Reboot, entzogenem Grant und Neu-Auswahl nach Deinstallation; Android kann App-Grants nach einer Deinstallation nicht erhalten.
4. Background-, Lockscreen-, Notification-, Audio-Focus- und App-Kill-Smoke mit React Native Track Player.
5. Equalizer-Hör-/Gerätekalibrierung auf mehreren Android-Geräten.
6. TrackPlayer-V5-/`@rntp/player`-Lizenz- und Migrationsentscheidung als separater Architektur-PR.

Die verbindlichen Abläufe stehen in [`../testing/android-dev-apk-smoke-report.md`](../testing/android-dev-apk-smoke-report.md), [`../release-checklist.md`](../release-checklist.md), [`../architecture/new-architecture-compatibility-audit.md`](../architecture/new-architecture-compatibility-audit.md) und [`../architecture/startup-hydration.md`](../architecture/startup-hydration.md).
