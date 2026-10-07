# Startup- und Hydration-Architektur

Stand: 2026-10-08

## Ziel

Die App soll die gespeicherte Bibliothek so früh wie sicher möglich anzeigen, ohne native Playback- oder SAF-Tag-Schreibvorgänge vor abgeschlossener Wiederherstellung freizugeben. Sichtbarkeit und Mutationsbereitschaft sind deshalb getrennte Zustände.

## Phasen und Freigaben

| Phase | Läuft | Blockiert die sichtbare App? | Freigabe |
| --- | --- | --- | --- |
| SAF-Tag-Recovery | JS-Owner werden wiederhergestellt; ein nativer Read-only-Status überspringt die teure Recovery nur bei nachweislich leeren Journalen und ohne zurückgehaltene Ergebnisbelege. | Nein. | Tag-Schreiben bleibt bis erfolgreicher Recovery fail-closed und stößt bei Bedarf einen Retry an. |
| Storage + Player-Setup | Persistierte Zustände werden gelesen, während TrackPlayer parallel initialisiert. Read-only-Storage-Aufrufe und die Legacy-Favoritenmigration starten ebenfalls parallel. | Nur solange noch keine sichere Bibliothek vorliegt. | Keine native Wiedergabe. |
| Bibliothek | Songs werden sanitisiert, IDs normalisiert und Playlists bereinigt. Danach wird `libraryHydrationReady` gesetzt. | Nein. | Bibliothek und Navigation werden sichtbar; Song- und Playlist-Änderungen werden bereits serialisiert persistiert, native Aktionen bleiben gesperrt. |
| Native Hydration | Queue-Wahrheit, aktueller Titel, Lautstärke, Repeat und Shuffle werden geprüft bzw. wiederhergestellt. | Nein, wenn die Bibliothek bereits verifiziert wurde. Playbackfehler erscheinen als Banner. | Erst `isReady` plus nativer Hydration-Gate-Status `ready` erlauben Playback-/Queue-Mutationen. |
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
- Song- und Playlist-Persistenz starten mit `libraryHydrationReady`, weil Änderungen an der sichtbaren Bibliothek auch bei Playback-Ausfall möglich sind. Playback-/Equalizer-Einstellungen bleiben an `isReady` gebunden.
- Jede Retry-Generation setzt `libraryHydrationReady` zuerst auf `false`. Vor neuen Storage-Reads wird der letzte akzeptierte Song-Snapshot ausdrücklich geflusht, einschließlich verzögerter Cover-Aufbereitung, bereits gestarteter Flushes und bestätigtem Storage-Commit. Anschließend wird die gemeinsame Playlist-Persistenz-Queue geleert. Ein leerer Storage-Writer allein belegt keinen fertigen Song-Flush, solange dessen Vorbereitung noch läuft.
- Schlägt Vorbereitung oder Persistenz fehl, endet der Retry ohne Storage-Read als `retry-required`. Der aktuelle In-Memory-Snapshot bleibt erhalten; Bibliotheksbearbeitung und ihre Persistenz werden wieder geöffnet. Ein weiterer Retry versucht den aktuellen Snapshot erneut. Ein unverifizierter initialer Storage-Load öffnet die Bibliotheksfreigabe dagegen nicht.
- Native Fehler-Fallbacks verändern ausschließlich Playback-/Queue-Zustand, soweit native Wahrheit verifiziert werden kann. Eine bereits erfolgreich hydrierte Bibliothek verliert ihre UI-/Persistenz-Freigabe durch fehlgeschlagenes Player-Setup, Queue-Readback oder Reset nicht. `isReady` bleibt dabei geschlossen und der Playbackstatus `degraded`. Laufende native Writer behalten ihre bestehende Sperre bis zur tatsächlichen Rückmeldung.
- Bereits akzeptierte Songänderungen werden beim Schließen der Readiness oder Unmount auch dann weiter geflusht, wenn ihre Vorbereitung schon läuft. Ihr Cover-Schutz bleibt bis zum Ende dieser Vorbereitung erhalten. Supersedierte normale Aufgaben dürfen dagegen weder alten State veröffentlichen noch später einen alten Write starten.
- Cover-/AudioInfo-Backfills starten nicht vor vollständiger nativer Hydration.

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

Der aktuelle Zielstand verwendet Expo SDK 57 / RN 0.86.3 mit New Architecture und `@rntp/player@5.12.1` hinter der lokalen Kompatibilitätsschicht `modules/playback-backend`. Der versionsgebundene Readiness-/Settlement-Patch bleibt erforderlich. Die frühere V4-Regel `newArchEnabled=false` ist nur für historische V4-Stände gültig; die native V4-Engine wird nicht wieder installiert. Migrationsnachweise und noch offene Hardwareprüfungen stehen in [`auftrag-1-2026-10-07.md`](../review/auftrag-1-2026-10-07.md).
