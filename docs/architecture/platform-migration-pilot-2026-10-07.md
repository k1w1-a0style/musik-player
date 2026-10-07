# Plattform-/Playback-Migrationspilot — V2

## Ausgangslage

Der V2-Fix-Branch bleibt auf Expo SDK 54, React Native 0.81.5 und `react-native-track-player@4.1.2`. `newArchEnabled=false` und der versionsgebundene RNTP-Patch bleiben unverändert. Die Migration ist geplant, aber **nicht in diesem Fix aktiviert**. Das verhindert kein künftiges Upgrade; es trennt die funktionale Behebung vom Plattformwechsel.

Die [bestehende RNTP-Inventur](trackplayer-new-architecture-options.md) und die [Legacy-FileSystem-Inventur](../sdk-upgrade-notes.md) sind Ausgangspunkte, keine aktuelle Zusicherung über APIs oder Lizenzbedingungen einer Zielversion. Diese müssen beim Pilot gegen die dann gültigen offiziellen Quellen und den tatsächlich installierten Code erneut geprüft werden.

## Isolierter Ablauf

| Phase | Ergebnis | Freigabebedingung |
| --- | --- | --- |
| Basis sichern | Getrennter `review/platform-pilot-*`-Branch vom getesteten `codex`-Commit; unveränderte Gerätemessung als Referenz | Basis-Commit, Build-Profil, Geräte-/Android-Version und Messprotokoll festhalten |
| Ziel evaluieren | Kompatible Expo/RN-Kombination und Playback-Backend samt Lizenz, Wartung, nativen Remote Controls und SDK-Voraussetzungen auswählen | Keine Zielversion oder Lizenzannahme ungeprüft aus alten Reviews übernehmen |
| Adapter migrieren | Playback-/Queue-/Repeat-/Progress-/Remote-Adapter und echte Tests umstellen; FileSystem nur in einem separat nachvollziehbaren Schritt | Alte App-Verträge einschließlich Deadline, bestätigtem Song und tatsächlicher Writer-Settlement bleiben erhalten |
| Native pilotieren | Development-Build mit Zielarchitektur, neuem Backend und aktualisierten eigenen Expo-Modulen | Build, native Tests und untenstehende Geräte-Matrix erfolgreich |
| Vergleich / Rollback | Gleiches Testmaterial mit Basis und Pilot messen; eigener Upgrade-PR | Keine Datenmigration ohne Rückwärts-/Rollback-Plan; explizite Maintainer-Freigabe |

Keine gekoppelten Versionssprünge für Expo, RNTP, FileSystem und Persistenz in einem unmessbaren Sammel-Commit. Eine notwendige Kopplung von Expo/RN und New Architecture gehört dokumentiert in den Pilot.

## Vertrags- und Geräte-Matrix

- Cold-/Warm-Start mit gespeicherter Queue und Seek-Position; 1.000 lokale/SAF-Titel. Bibliothek darf vor Audio-Hydration sichtbar werden; ausgewählter und nativ bestätigter Song dürfen nicht verwechselt werden.
- Queue-Wiederverwendung/-Rebuild, schneller A→B→C-Wechsel, zehn Next/Previous-Events, Seek→Songwechsel, Shuffle und Repeat off/all/one.
- Native Hänger bei Reset/Add/Skip/Seek sowie verspätete Antworten: sichtbarer Fehler, keine konkurrierenden Writer, Retry erst nach tatsächlicher Settlement.
- Play/Pause/Stop/Next/Previous/Seek aus App, Notification, Lockscreen und Bluetooth; Background, Screen-Off, Task-Removal, Neustart und Audio-Focus/Anruf-Unterbrechung.
- Equalizer beim Audio-Session-Wechsel und schnellen Slider-Änderungen; kein Zugriff nach Release/Destroy.
- MediaLibrary-/SAF-Import, verweigerte/bestehende Grants, langsamer Provider, >90 Sekunden gesunder Fortschritt, Teilerfolg/Abbruch/Wiederholung und Dateirevisionen.
- Native Cover-Leases bei langer Kopie, Cache-Druck, Abort und verspätetem Ergebnis; Waveform-Cold-Start nach App-Neustart und Quota-Eviction. Keine Voraussetzung für die Wiedergabe.
- Tag-Writes mit Backup/Temp/Byteprüfung auf unterstützten lokalen/SAF-Quellen. Unsupported Layouts, fehlende Grants und große Dateien bleiben blockiert. Originaldateien müssen auch nach Fehler/Abbruch byte-identisch erhalten bleiben.

Mindestens ein schwächeres reales Android-Gerät (beispielsweise das bereits verwendete A50) und ein aktuelleres Gerät verwenden. Release-/Development-Builds vergleichen, nicht Expo Go. Warm-/Cold-Messungen getrennt ausweisen; keine Latenzversprechen aus Jest-Mocks ableiten.

## Abbruch und Rückkehr

Bei verlorenen Remote Events, Writer-Parallelität, Persistenzverlust, nativen Crashes, schlechterer speicherbegrenzter Importfähigkeit oder ungeklärter Lizenz keine Freigabe. Zum bestätigten Basis-Commit zurückkehren; ursprüngliche Library-, Cover- und Waveform-Dateien nicht für den Pilot destruktiv migrieren. RNTP-Patch erst entfernen, wenn das Backend wirklich ersetzt und die Patch-Abwesenheit getestet ist.
