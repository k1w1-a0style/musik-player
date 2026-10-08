# Runtime Deep Scan V4 – Scan und Android-Blockaden

08.10.2026 · Branch `codex` · Ausgangspunkt `246a740b7f1f13f1b3c2db23c2080b312ced6f0b`

## Ergebnis und Aussagegrenze

Die erneute Prüfung bestätigt mehrere unabhängige Blockademechanismen und zwei Fehler beim Aktualisieren von Wiedergabemetadaten. Die hier beschriebenen Korrekturen sind implementiert. Ein blockierter Android-Dateianbieter bleibt technisch ein laufender nativer Zugriff; der Fix begrenzt dessen tatsächliche Parallelität und verhindert, dass dieser Zugriff die gemeinsame Expo-Warteschlange oder unbegrenzt die sichtbare Vorbereitung blockiert.

Der Screenshot ist lesbar: Schnellscan abgeschlossen, 10/10 Dateien, zehn unverändert. Das Symbol am M4A-Titel ist die Wiederholen-Aktion aus `SongWaveformStatus`, kein animierter Scanindikator. Damit sind ein fehlgeschlagener Vorbereitungsschritt und ein abgeschlossener Dateiscan gleichzeitig sichtbar. Der Screenshot allein beweist weder einen Android-ANR noch dessen genaue Ursache. Die problematischen MP3/M4A-Dateien und ein direkter Zugriff auf das A50 fehlen; eine Geräte-Reproduktion wird nicht behauptet.

## Bestätigte Befunde und Korrekturen

| ID / Priorität | Auslöser und bisheriges Verhalten | Korrektur | Nachweis |
| --- | --- | --- | --- |
| R1 / hoch | `SystemAudioModule` führte Retriever-, Artwork-, Palette- und Tag-Arbeit direkt in Expo-AsyncFunction-Bodies aus. Die installierte Expo-Version besitzt eine gemeinsame `AsyncFunctionQueue`. Ein hängender Provider konnte damit auch die Registrierung unabhängiger Waveform-/Stat-Aufträge blockieren. JS-Timeouts beenden diese native Arbeit nicht. | Kurze Promise-Dispatch-Bodies; getrennte, begrenzte Worker für Medien, Palette, Thumbnails, Stats, Tags, EQ und Lease-Cleanup. Tatsächliche Worker bleiben bis zur echten Rückkehr belegt. Keine unbegrenzte Warteliste. Tags bleiben geordnet; Teardown unterbricht keine bereits laufende SAF-Mutation. | Vier neue JVM-Tests prüfen blockierte Leser bei weiterhin erreichbaren unabhängigen Diensten, Kapazitätsgrenzen, Shutdown und Fehler-Settlement. Native Compile/Test-Abnahme erfolgt über den CI-Lauf dieses Commits. |
| R2 / mittel | Palette, Stat und Metadaten teilten auch im JS-Facade ein Budget. Zwei hängende Palette-Aufträge konnten damit unabhängige Metadaten verhindern. | Palette, Stat und Thumbnail erhalten eigene JS-Budgets passend zu den nativen Workern. Audioinfo, Fast-Metadaten und eingebettetes Artwork teilen weiter bewusst zwei tatsächliche Medienzugriffe. | Bestehende Lane-Tests vor der Korrektur mit den neuen Erwartungen rot; nach der Korrektur grün. |
| R3 / hoch | Explizite Vorbereitung wartete vor ihrer ersten Running-Veröffentlichung auf History/Cache-IO. Cache-Reads und -Writes sowie Hintergrund-/Nachbartitel-Preloads hatten unbegrenzte Speicherwartezeiten. Abbruch konnte nicht bis hinter einen offenen Zugriff gelangen. Ein fehlgeschlagener Write konnte bereits dekodierte Daten als unavailable markieren oder den Idle-Batch weiterlaufen lassen. | Running wird sofort publiziert; optionale History blockiert nicht. Cache-Beobachter haben 10-Sekunden-Deadline und AbortSignal. Ein Speicherfehler stoppt den Batch sichtbar bzw. den Idle-Durchlauf; echte Schreibreihenfolge bleibt erhalten. Gültige Waveforms im Speicher bleiben nutzbar. | Vier Storage-Regressionen für sofortigen Status/Abbruch, Deadline, hängende History und Disk-full. Drei weitere Regressionen für Idle-Fehler und blockierten Nachbartitel-Cache waren vor der Korrektur rot. |
| R4 / mittel | Nach dem zeitlich begrenzten Lesen lagen finaler Bibliothekscommit und Ordnerpersistenz außerhalb des Wartebudgets. Ein hängender Abschluss hielt Loading und die globale Metadata-Koordination aktiv. | Auch diese Beobachter verwenden das bestehende Importbudget und das Generation-Abbruchsignal. Ordner-Timeouts werden nicht als Erfolg geschluckt. Der echte Checkpoint-/Storage-Writer behält seine Sperre; ein Folgescan wartet auf dessen tatsächlichen Abschluss. | Tests für leeres und nichtleeres Scanergebnis mit hängender Ordnerpersistenz sowie für finalen Write-Timeout, unveröffentlichten Späterfolg und erhaltene Storage-Barriere. |
| R5 / mittel | Busy-/Timeout-/Providerfehler wurden als leeres Artwork-Ergebnis behandelt. Import/Backfill konnte dadurch `embeddedArtworkChecked=true` speichern, obwohl die Datei gar nicht geprüft wurde. | Neue Inspection unterscheidet bestätigtes Ergebnis von ungeprüfter Quelle. Skips/Fehler bleiben retryfähig; ein fehlgeschlagener nativer Cache-Handoff ist ebenfalls ein Fehler. Späte Staging-Receipts werden freigegeben. | Neun neue Facade-/Consumer-Tests einschließlich zwei zeitlich abgelaufener Rohzugriffe, genau einer Freigabe pro Receipt und Import-/Backfill-Verhalten. |
| R6 / mittel | Entferntes Album/Cover wurde als undefined aus dem vollständigen Song-Snapshot weitergegeben. V5 behielt dadurch alte Display-Metadaten. | Vollständiger Library-Refresh sendet explizites null für gelöschte Felder. Teilupdates behalten ihre bisherige undefined-Semantik. | Helper-Test und Test über die echte installierte V5-JS-Konvertierung bestätigen null bis zur nativen Grenze. |
| R7 / mittel | Ein Queue-Move konnte zwischen altem Index-Snapshot und Metadata-Write liegen. Der Titel von A konnte auf B geschrieben werden. | ID wird im geordneten Adapter-Turn neu aufgelöst. Die gepinnte Android-Patchroutine prüft `expectedMediaId` nochmals auf dem Controller-Thread vor dem Write. Fehlende/gewechselte Titel werden abgewiesen. | Move-Regression und entfernte-ID-Regression über den tatsächlichen V5-JS-Adapter; Patch-Hash/Quellvertrag geprüft. Native Ausführung ist Teil der CI-Abnahme. |

Der Waveform-Worker nutzt ebenfalls den begrenzten Executor: Auch ein Fehler vor dem bisherigen Decoder-try/finally, etwa beim Ressourcen-Konstruktor, erhält eine Promise-Antwort. Native Kapazitätsablehnung wird als vorübergehende Scheduler-Knappheit behandelt, bleibt pending und erzeugt keinen dateibezogenen Fehler-Backoff. Die Wiederholungszahl und das Scheduler-Wartebudget bleiben begrenzt.

## Projektweite Prüfabdeckung

| Bereich | Geprüfte Verträge |
| --- | --- |
| SAF / MediaLibrary / Import | Discovery-Grenzen, Directory-/Datei-Timeouts, zwei tatsächliche Datei-Reads, Generationen, Teilresultate, unveränderte Dateirevisionen, Checkpoints, UI-Throttling und finaler Abschluss. |
| Waveform / Vorbereitung | Priorität, echte Decoder-Lifetime, Raw-Slot-Erhalt, Cancel/Preemption, Source-Fingerprint, Formatentscheidungen, Cache-Recovery, Hintergrund-/Nachbartitel und wiederholbare Fehler. |
| Playback / Queue / Metadaten | V5-Readiness und Settlement, gemeinsame Control-Lane, Queue-ID-Wahrheit, stale Metadaten, explizites Löschen, Native-Thread-Prüfung und gepinnte Patch-Hashes. |
| Persistenz / Cover / Recovery | Geordnete echte Writer, Checkpoint-Barriere, Cover-Sanitizing/Leases, späte Resultate, History optional, vorhandene Bibliotheksmanifest-/Tag-Recovery-Regressionen. |
| UI / Lifecycle | Statusdarstellung, Abbruch, Wiederholen/Fortsetzen, List-/Player-/Playlist-Regressionen, vorhandene Schrift-/Theme-/Layout-Verträge. |
| Android / Sicherheit / Build | Lokale Kotlin-Änderungen und JVM-Testquellen geprüft; CI baut die realen Module. Vorhandene Config-, Permission-, Bundle-Boundary-, Dependency-Audit- und Signaturprüfungen bleiben aktiv. |

Dies ist eine kritische Quell- und Regressionprüfung des aktuellen Projekts, keine Behauptung einer vollständigen dynamischen Geräteabnahme jedes Bildschirms oder eines Beweises der Fehlerfreiheit aller Dateien.

## Verifikation

Lokaler Gesamtstand vor den letzten Abschlusskorrekturen: **371 Suites / 3.681 Tests bestanden**. Danach betroffene Regressionen separat erneut ausgeführt: sieben Suites / 66 Tests und vier Suites / 76 Tests bestanden; diese Mengen überlappen und werden nicht zu einem Gesamtwert addiert. TypeScript, ESLint ohne Warnungen, Complexity-Gate (3.455 Produktionsfunktionen), Source-NUL-Gate (943 Textquelldateien), 13 Python-Diagnostiktests, Diff-Whitespace und installierte V5-Patch-Hashes sind grün.

Die verbindliche Gesamtfreigabe ist der nachfolgende CI-Lauf dieses Commits: gesamtes Jest mit Coverage, Online-Expo-Kompatibilität, Produktions-Android-Export und Dependency-Boundary, Release-Config/Berechtigungen, Gradle-Compile, reale JVM-Tests beider nativer Module, APK-Identität und Signatur. Ein grüner JS-Testlauf allein ist keine native Freigabe. Native Build-/Test-Ergebnisse und die exakte Quellrevision stehen im CI-Lauf und den APK-Sidecars.

Die vorhandenen, befristeten Dependency-Ausnahmen für `braces` und `node-forge` werden unverändert durch die exakte Audit-Policy geprüft und nicht verlängert (Issue #396, Ablauf 21.10.2026). Daher wird der Build nicht als frei von allen Dependency-Advisories beschrieben.

## Noch benötigte Geräteabnahme

Nach Installation der neuen Preview über die bestehende App: denselben M4A-Titel vorbereiten, Schnell- und Vollscan ausführen, während laufender Vorbereitung abbrechen/fortsetzen und parallel Titel wechseln. Bei einem erneut hängenden Dateianbieter müssen die unabhängigen Dienste erreichbar bleiben und der sichtbare Durchlauf innerhalb seiner jeweiligen Wartebudgets enden. Ein vollständig defekter Provider kann seinen nativen Worker dauerhaft belegen; die APK kann dessen OS-Aufruf nicht zuverlässig zwangscanceln. Ein App-Neustart kann dann weiterhin erforderlich sein.

Noch offen sind ein Logcat/ANR-Nachweis des konkret gemeldeten A50-Hängers, reale Decoderzeiten der betroffenen Dateien, Cloud-/USB-/SD-SAF-Szenarien, Display-Aus/OS-Kill sowie p50/p95 und Frame-/RAM-Messungen. Die Prüfungen verändern keine Musikdateien als Reparaturmaßnahme und verwenden das vorhandene Preview-Zertifikat.
