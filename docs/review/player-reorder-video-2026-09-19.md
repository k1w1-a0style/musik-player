# Player: Videoanalyse und Reorder-Korrektur

Ausgangsstand: `51c7fead3de637a88b20192c2d7d20ca08f7aef5`, Branch `codex`.

## Beobachtungen

Ausgewertet wurden die Bildfolge der Aufnahme vom 15. September (4:04 Minuten),
die automatische deutsche Sprachtranskription, die beigefügten Laufzeitlogs sowie
eine ältere SoundCloud-Aufnahme und zwei SoundCloud-Screenshots. Die automatische
Transkription enthält Erkennungsfehler; Titelzuordnungen wurden an den Bildern geprüft.
Eine SoundCloud-APK war nicht mehr verfügbar. Eine APK-Analyse oder Messung der
aktuellen SoundCloud-Android-Version wird daher ausdrücklich nicht behauptet.

| Stelle, ungefähr | Befund |
| --- | --- |
| 0:48–1:07 | Beim ersten Öffnen eines Tracks bleibt die Waveform lange eine Linie. Die Sprachbeschreibung bestätigt die fehlende Orientierung beim Spulen. |
| 1:47–2:49 | Nach Queue-Bewegungen springt die aktive Markierung; angetippte Zeile und tatsächlich wiedergegebener Track stimmen nicht zuverlässig überein. |
| 2:57 und 3:42 | Cover/Titel und angezeigte Decoder-Laufzeit passen nicht zusammen: 3:13 und 4:12 werden den falschen Tracks zugeordnet. |
| 3:14–3:42 | Frühere und laufende Tracks lassen sich nicht mehr per Gedrückthalten verschieben. |
| 3:52 | Die klassischen Cover teilen eine ortsfeste, abgerundete Maske; nur die Bilder darin wandern. |

Die neuen Logs zeigen 59,063 Sekunden für das kalte Metro-Bundle, 5,347 Sekunden
für die Hydration, ungefähr 13,2–20,5 Sekunden für erste native Waveform-Analysen
und 0–1 Millisekunden für spätere Cache-Treffer. Metro und Audioanalyse sind
unterschiedliche Vorgänge. Wiederholte identische `analysis`-Zeilen sind kein Beleg
für mehrere Decoder: bisher loggte jeder wartende Aufrufer das gemeinsam erhaltene Ergebnis.

## Nachgewiesene native Ursache

RN Track Player 4.1.2 bindet KotlinAudio 2.1.0 ein. Dessen
[`QueuedAudioPlayer.move`](https://github.com/doublesymmetry/KotlinAudio/blob/v2.1.0/kotlin-audio/src/main/java/com/doublesymmetry/kotlinaudio/players/QueuedAudioPlayer.kt)
verschiebt die ExoPlayer-Quelle nach `toIndex`, verwendet bei einer Bewegung nach
oben in seiner separaten Metadatenliste jedoch `toIndex - 1`.

Beispiel: `A,B,C`, Bewegung `2 -> 1`.

| Datenquelle | Ergebnis |
| --- | --- |
| Tatsächlich abgespielte ExoPlayer-Quellen | `A,C,B` |
| KotlinAudio-Metadaten, RNTP `getQueue` / `getActiveTrack` | `C,A,B` |

Der bestehende Recovery-Pfad liest diese bereits beschädigte Metadatenliste zurück.
Deshalb verhindert „reconciled to native state“ weder ein falsches Cover noch einen
falschen Titel. Der bisherige Emulatorablauf verschob ausschließlich nach unten.
Seine Prüfung des MediaSession-Titels war ebenfalls nicht unabhängig von den
fehlerhaften Metadaten.

## Änderungen

- Der versionsgebundene RNTP-Installationspatch ersetzt `player.move` durch
  `moveQueueItemSafely`. Dieser verwendet die konsistenten öffentlichen
  Add-/Remove-Operationen. Die gerade spielende MediaSource wird niemals entfernt;
  beim Verschieben des aktiven Tracks werden stattdessen die dazwischenliegenden
  inaktiven Einträge versetzt. Die Operation läuft synchron auf dem nativen Main-Thread.
- Queue-Plan und beide Queue-Oberflächen erlauben auch frühere und aktive Tracks.
  Die Auswahl bleibt an der Song-Identität gebunden. Kurze, vollständig passende
  Listen starten oben, statt frühere Zeilen hinter einem anfänglichen Scrolloffset
  zu verbergen.
- Jedes klassische Cover besitzt seinen eigenen abgerundeten Rahmen und Schatten.
  Ganze Karten bewegen sich mit Abstand über die Bildschirmbreite.
- SoundCloud-Waveform: kommende Balken sind weiß, gespielte Balken behalten die
  dunklere Akzentfarbe. Mittellinie und Waveform bleiben beim Pausieren erhalten.
  Bis echte PCM-Daten vorliegen, bleibt die stabile Linie bestehen.
- Eine geteilte Decoder-Ausführung erzeugt nur noch eine `analysis`-Timingzeile.
  Ein bestehender Waveform-Cache wird nicht invalidiert.

Die historische SoundCloud-Veröffentlichung beschreibt kleine, vorberechnete und
gecachte Waveform-Daten; sie belegt nicht die Implementierung der heutigen Android-APK:
[Waveform-Daten](https://developers.soundcloud.com/blog/waveforms-let-s-talk-about-them/),
[Render-Ebenen](https://developers.soundcloud.com/blog/ios-waveform-rendering/).
Die vorhandene lokale Vorberechnung und der Cache sind weiterhin entscheidend.
Diese Änderung verspricht keine unbelegte Beschleunigung einer vollständigen
Erstanalyse auf dem Handy. Die gemessenen 13–20 Sekunden bleiben ein offener
Performancepunkt; die optische Korrektur und bereinigte Telemetrie lösen ihn nicht.

## Prüfung und Grenzen

- Die neuen Queue-/Cover-Regressionen schlugen vor der Korrektur fehl; danach
  bestanden die 47 gezielten Tests.
- Vollständiger Jest-Lauf mit Coverage: 317 Suites, 3.065 Tests bestanden.
  TypeScript, ESLint und Komplexitätsprüfung bestanden ebenfalls.
- Drei direkt mit Kotlin/JUnit ausgeführte Tests prüfen den tatsächlichen Helper,
  einschließlich aller 64 Kombinationen aus aktivem, verschobenem und Zielindex
  einer Vierer-Queue. Quelle, Titel, URI und Laufzeit bleiben zusammen; die aktive
  MediaSource behält ihre Objektidentität.
- Der vorhandene Android-Interaktionstest ist erweitert: Aufwärts-Drag, Long-Press,
  aktiver Track an Anfang/Ende, Positionskontinuität, alle drei Dateiformate und
  Playlist-Wiedergabe nach Reorder. Er vergleicht den Titel zusätzlich mit der
  über RNTP `useProgress` gelesenen Decoder-Laufzeit. Drei unterschiedliche
  Testfrequenzen erleichtern eine anschließende Hörkontrolle.
- Ein zusätzlicher echter Touch-Ablauf hält den klassischen Cover-Swipe in der
  Mitte fest und prüft die getrennten Kartenpositionen samt Abstand im Screenshot.
- Die GitHub-CI für `08682de5` bestand mit 3.065 JavaScript- und 125 nativen Tests.
- Der [erste neue APK-/Android-Lauf](https://github.com/k1w1-a0style/musik-player/actions/runs/35488715068)
  baute, prüfte, installierte und startete die neue Development-APK erfolgreich.
  Im Android-35-Emulator bestanden Waveform-Farben/Mittelpunkt, Spulen während
  Wiedergabe und Pause, Zurück-Swipe, stabiler Cache, alle fünf Queue-Drags
  einschließlich Aufwärtsbewegung und laufendem Track sowie die anschließende
  unabhängige Decoder-Laufzeitprüfung für A, C und B. Keine Reorder-Fehlermeldung.
  Auch Playlist-Griff und Playlist-Long-Press funktionierten.
- Danach stoppte der Test: Eine Playlist-Zeile hatte keinen `onPress`-Aufruf;
  der dort vom Test gesuchte Mini-Player gehört außerdem nur zur Bibliotheksseite.
  Kurzes Antippen startet jetzt den gewählten Song mit der aktuell angezeigten
  Playlist-Reihenfolge und öffnet nach bestätigter Wiedergabe den Player.
  Der Abspielen-Button nutzt denselben Pfad. Die drei betroffenen Regressionen
  schlugen vor der Korrektur fehl; danach bestanden alle 24 Playlist-Screen-Tests.
- Der [erneute vollständige Android-Ablauf für `950b4e18`](https://github.com/k1w1-a0style/musik-player/actions/runs/35504936605)
  bestand einschließlich Playlist-Wiedergabe in der verschobenen Reihenfolge
  und der getrennten Coverrahmen mitten im gehaltenen Finger-Swipe. Die
  [zugehörige CI](https://github.com/k1w1-a0style/musik-player/actions/runs/35504836517)
  bestand mit 317 Suites, 3.067 JavaScript- und 125 nativen Tests.
  Der erste, oben beschriebene Lauf bleibt ausdrücklich ein Teilnachweis.

Die kalten PCM-Analysen dauerten in diesem softwaregerenderten Emulatorlauf
0,289 / 5,219 / 21,218 Sekunden; späteres Wiederöffnen traf den Cache mit 0 ms.
Hydration: 4,771 Sekunden, ohne Startup-Retry. Die große Streuung belegt weiterhin
keine garantierte kurze Erstanalyse auf dem Handy.

Im vollständig bestandenen zweiten Lauf dauerten die drei kalten Analysen
0,167 / 4,571 / 16,361 Sekunden, die Cache-Treffer 0–1 ms.
Hydration: 3,708 Sekunden, ebenfalls ohne Startup-Retry. Ein Dialog des
**Pixel Launcher** wurde protokolliert geschlossen; es war kein ANR der Musik-App.
Die Emulatorwerte sind kein Geschwindigkeitsversprechen für das Nutzergerät.

## Angrenzende Gesten- und Fehlerpfade

Die zusätzlich beauftragte Prüfung fand zwei zusammenhängende Fehlerbereiche:

- Ein nie aktiv gewordener horizontaler Recognizer konnte mit `FAILED` oder
  `CANCELLED` einen bereits laufenden Trackwechsel zurücksetzen. Das gab den
  eingefrorenen Titel-/Cover-Snapshot zu früh frei. Nur der Abbruch einer zuvor
  tatsächlich aktiven Wischgeste startet jetzt die Rückwärtsanimation.
- Ein vom Playback-Callback abgewiesener Seek ließ die Vorschau bis zu 2,5 Sekunden
  auf der nicht bestätigten Position stehen. Jetzt wird unmittelbar die zuletzt
  bekannte Wiedergabeposition verwendet. Nur die noch zugehörige Anfrage darf
  ihre Vorschau zurücksetzen: ältere Fehler überschreiben weder neuere Seeks noch
  einen anderen Track. Beim Trackwechsel wird auch die Zeichenposition sofort
  synchronisiert, statt bis zur nächsten Fortschrittsabfrage den alten Wert zu zeigen.

Fünf neue Fehlerfälle wurden zuerst am bisherigen Code reproduziert; danach
bestanden alle 35 gezielten Gesten-/Cover-/Waveform-Tests, einschließlich spät
eintreffender Fehler nach einem Trackwechsel oder Unmount. Diese deterministischen
Tests prüfen die Zeitfolge; sie ersetzen keine native Android-Gestenprüfung.
Die abschließende CI und Android-Prüfung für diesen Zusatz stehen noch aus.

Der Fix verändert nativen Code. Ein Metro-Reload der alten Development-APK reicht
nicht. Eine **neue Development-APK** wurde aus `950b4e18` gebaut und der erweiterte
Interaktionstest bestanden. Die zusätzlichen Fehlerpfad-Korrekturen betreffen
JavaScript. Der vorhandene manuelle
Workflow `android-emulator-smoke.yml` bleibt unverändert: Branch `codex`, Eingabe
`BUILD_DEVELOPMENT_APK`. Es wurde kein Release-Build gestartet und kein Build-Gate geöffnet.
