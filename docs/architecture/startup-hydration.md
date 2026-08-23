# Startup- und Hydration-Architektur

Stand: 2026-08-22

## Ziel

Die App soll die gespeicherte Bibliothek so früh wie sicher möglich anzeigen, ohne native Playback- oder SAF-Tag-Schreibvorgänge vor abgeschlossener Wiederherstellung freizugeben. Sichtbarkeit und Mutationsbereitschaft sind deshalb getrennte Zustände.

## Phasen und Freigaben

| Phase | Läuft | Blockiert die sichtbare App? | Freigabe |
| --- | --- | --- | --- |
| SAF-Tag-Recovery | JS-Owner werden wiederhergestellt; ein nativer Read-only-Status überspringt die teure Recovery nur bei nachweislich leeren Journalen und ohne zurückgehaltene Ergebnisbelege. | Nein. | Tag-Schreiben bleibt bis erfolgreicher Recovery fail-closed und stößt bei Bedarf einen Retry an. |
| Storage + Player-Setup | Persistierte Zustände werden gelesen, während TrackPlayer parallel initialisiert. Read-only-Storage-Aufrufe und die Legacy-Favoritenmigration starten ebenfalls parallel. | Nur solange noch keine sichere Bibliothek vorliegt. | Keine native Wiedergabe. |
| Bibliothek | Songs werden sanitisiert, IDs normalisiert und Playlists bereinigt. Danach wird `libraryHydrationReady` gesetzt. | Nein. | Bibliothek und Navigation werden sichtbar; Playlist-Änderungen werden bereits serialisiert persistiert, native Aktionen bleiben gesperrt. |
| Native Hydration | Queue-Wahrheit, aktueller Titel, Lautstärke, Repeat und Shuffle werden geprüft bzw. wiederhergestellt. | Normalerweise nein; ein bestätigter degradierter/retry-required Zustand zeigt den Recovery-Screen. | Erst `isReady` plus nativer Hydration-Gate-Status `ready` erlauben Playback-/Queue-Mutationen. |
| Post-Start | Cover- und AudioInfo-Backfills laufen erst nach `isReady`. | Nein. | Hintergrund-Metadatenarbeit. |

Die drei Bricolage-Schriften werden über das `expo-font`-Config-Plugin in den nativen Build
eingebettet. Es gibt bewusst keinen JavaScript-`useFonts`-Start-Gate mehr: Provider und
Navigation mounten sofort. Nach einer Änderung der nativen Font-Konfiguration ist deshalb
ein neuer Development Build nötig; ein reiner Metro-Reload kann diese Änderung nicht
nachladen.

Sekundäre Screens (`NowPlaying`, Track-Info, Tag-Editor, Equalizer, Einstellungen und Playlist-Detail) verwenden React Navigation `getComponent` und werden nicht beim initialen Rendern ausgewertet. Der initiale `MainShell` bleibt statisch importiert.

## Sicherheitsinvarianten

- Ein leerer JS-Owner-Journal allein reicht nicht zum Überspringen der nativen SAF-Recovery. Der native Status muss verfügbar sein und exakt `pendingCount=0`, `retainedOutcomeCount=0` sowie eine leere Transaktionsliste melden.
- Fehlt das neue Statusfeld in einem älteren Development Build, ist der Status nicht beweiskräftig; die App fällt auf die vollständige Recovery zurück.
- Ein Fehler oder Timeout der Hintergrund-Recovery blockiert die normale App-Nutzung nicht, aber jeder spätere Tag-Schreibversuch bleibt ohne erfolgreiche On-Demand-Recovery gesperrt.
- `libraryHydrationReady` ist nur eine UI-Freigabe. Native Playback-, Queue- und Current-Song-Aktionen richten sich ausschließlich nach `isReady` und dem generationsgebundenen nativen Hydration-Gate.
- Hydration-Fallback und TrackPlayer-Setup laufen nie gleichzeitig gegeneinander.
- Playlist-Persistenz startet mit `libraryHydrationReady`, weil Playlist-Änderungen in der sichtbaren Bibliothek bereits möglich sind. Ein serialisierter Latest-wins-Writer verhindert, dass ein älterer Snapshot eine frühe Änderung überschreibt.
- Jede Retry-Generation setzt `libraryHydrationReady` zuerst auf `false` und wartet auf den Drain der gemeinsam genutzten Playlist-Persistenz-Queue; damit beginnen neue Storage-Reads erst nach allen älteren Playlist-Writes. Schlägt der neueste Write fehl, wird der Retry ohne Storage-Read als `retry-required` beendet, der In-Memory-Snapshot bleibt erhalten und die Playlist-Persistenz wird für einen erneuten Write wieder geöffnet. UI und Playlist-Persistenz bleiben sonst geschlossen, bis der neue Snapshot vollständig normalisiert und veröffentlicht ist.
- Ein verifizierter Fehler-Fallback leert nur den nativen Playback-/Queue-Zustand. Die letzte Bibliothek einschließlich Playlists bleibt im Speicher, ihre UI- und Persistenz-Freigabe bleibt geschlossen und der Status wird `degraded`, bis ein Retry erfolgreich ist. Dadurch wird weder eine inkonsistente Library als `ready` veröffentlicht noch ein leerer Fallback über den gespeicherten Bestand geschrieben.
- Playback-/Equalizer-/Song-Persistenz sowie Cover-/AudioInfo-Backfills starten nicht vor vollständiger Hydration.

## Warum ein kalter Dev-Start länger dauert

Ein Dev-Start umfasst mehr als die App-Hydration: Der Development Client verbindet sich mit Metro; Metro transformiert bei kaltem oder geleertem Cache den erreichbaren Modulgraph, erzeugt Source Maps und aktiviert Entwicklungsinstrumentierung. Danach wertet Hermes den Startpfad aus und die oben beschriebenen App-Phasen beginnen. Ein laufender Metro-Prozess mit warmem Cache ist daher deutlich aussagekräftiger für den täglichen Entwicklungszyklus; ein Release-Build ist der Maßstab für Nutzer-Startzeiten.

Ein lokaler Kontrolllauf am 2026-08-22 bestätigt die Größenordnung: Ein vollständig kalter
Android-/Hermes-Export musste 3.213 Module transformieren und benötigte allein für das
Bundling rund 15,7 Sekunden. Das ist **keine** gemessene Geräte-Startzeit, erklärt aber den
großen Unterschied zwischen erstem Dev-Start mit leerem Metro-Cache und späteren warmen
Reloads.

Das verzögerte `getComponent` reduziert frühe Modulevaluation. React Native erhält dadurch jedoch kein garantiertes natives Bundle-Splitting. Ebenso wird `inlineRequires` nicht pauschal aktiviert: Eine globale Änderung der Auswertungsreihenfolge kann Side-Effect-sensitive Module beschädigen und muss getrennt gegen Production Tree Shaking und Playback-/Service-Initialisierung geprüft werden.

Referenzen: [Expo Metro](https://docs.expo.dev/versions/latest/config/metro/), [Expo Tree Shaking](https://docs.expo.dev/guides/tree-shaking/), [Metro-Konfiguration](https://metrobundler.dev/docs/configuration/).

## Diagnose

In Nicht-Test-Builds erscheinen datensparsame Ereignisse als `[StartupTiming]`:

| `phase` | Aussage |
| --- | --- |
| `music-storage` | Persistierte Musikdaten und Migration gelesen. |
| `music-library` | Sanitierte Songs/Playlists sichtbar; enthält nur Anzahlen. |
| `track-player-setup` | TrackPlayer-Setup abgeschlossen oder fehlgeschlagen. |
| `music-hydration` | Gesamte native Hydration beziehungsweise Fallback beendet. |
| `tag-write-recovery` | Hintergrund-Recovery bereit, fehlgeschlagen oder im Watchdog-Timeout. |

Jedes Ereignis enthält `outcome` und `durationMs`; Titel, Dateinamen und URIs werden nicht protokolliert.

Für einen belastbaren Vergleich:

1. Warmen Dev-Start bei laufendem Metro messen.
2. Kalten Dev-Start separat messen, ohne routinemäßig den Cache zu löschen.
3. Release-APK auf demselben Android-Gerät mindestens mehrfach cold-starten und Median/P95 vergleichen.
4. Parallel die `[StartupTiming]`-Phasen erfassen, damit Metro-/Prozesszeit und App-Hydration nicht vermischt werden.

## New Architecture

`newArchEnabled=false` bleibt unverändert. Mit `react-native-track-player@4.1.2` ist das eine harte Repository-Regel und kein Hebel für die hier gefundenen JS-/Hydration-Blockaden. Der Upgrade-Pfad, Risiken und Exit-Kriterien stehen in [`new-architecture-compatibility-audit.md`](new-architecture-compatibility-audit.md) und [`trackplayer-new-architecture-options.md`](trackplayer-new-architecture-options.md). Eine Aktivierung gehört in einen separaten PR mit neuem Dev-Build sowie Foreground-, Background-, Notification-, App-Kill- und echten Android-Smoke-Tests.
