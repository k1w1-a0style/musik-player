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
Die [CI für `16625bde`](https://github.com/k1w1-a0style/musik-player/actions/runs/35523113591)
bestand anschließend mit 317 Suites, 3.072 JavaScript- und 125 nativen Tests.
Die abschließende Android-Prüfung für diesen Zusatz stand zu diesem Zeitpunkt noch aus;
die nachfolgenden Abschnitte dokumentieren die Fortsetzung.

## Fortsetzung am 20. September

Der [Android-Lauf für `16625bde`](https://github.com/k1w1-a0style/musik-player/actions/runs/35523176024)
baute und prüfte die Development-APK erfolgreich. Versuch 1 installierte und
startete sie, brach dann vor den Bedienprüfungen mit einer ungültigen JSON-Antwort
von UIAutomator ab. Der anschließende Screenshot-Befehl endete mit Code 255;
dadurch übersprang der bisherige `finally`-Block auch Logcat und Gfxinfo.
Versuch 2 baute, installierte und startete ebenfalls erfolgreich, endete aber
bereits beim Logcat-Auslesen mit Code 255 und einer abgeschnittenen Ausgabe.
Diese Läufe sind keine erfolgreiche Android-Freigabe. Die genaue Ursache des
ADB-/UIAutomator-Abbruchs ist mit den vorhandenen Daten noch nicht bewiesen.

Die Diagnoseerfassung behandelt jetzt jeden ADB-Aufruf unabhängig und begrenzt
seine Wartezeit. Exitcodes und Standardfehler werden mitgesichert. Ein kaputter
Screenshot verhindert weder weitere Protokolle noch überdeckt er den ursprünglichen
Testfehler. Ein zusätzlicher abschließender Workflow-Schritt erfasst Diagnosen
auch bei einem Abbruch vor dem Interaktionstest. Die eigentlichen App-Prüfungen
und die manuelle Development-Build-Freigabe bleiben erhalten.

Der bisherige Abbruch der Diagnosekette wurde lokal nachgestellt. Drei
Python-Regressionen prüfen Screenshot-Ausfall, Logcat-Timeout und einen nicht
beschreibbaren Ausgabeort. Die 275 bestehenden Workflow-/Sicherheitsprüfungen
bestanden nach der Änderung. Ein neuer Android-Lauf mit diesen Diagnosen ist nötig.

Weiterhin offen bleibt die kalte Waveform-Berechnung. Die bisherigen Messungen
belegen schnelle Cache-Treffer, aber keine allgemeine Ein-Sekunden-Erstanalyse.

## Fortsetzung am 26. September

Die [CI des Diagnose-Fixes `1b9c07a`](https://github.com/k1w1-a0style/musik-player/actions/runs/35543124986)
ist vollständig bestanden. Der [Android-Durchlauf mit diesem Fix](https://github.com/k1w1-a0style/musik-player/actions/runs/36244287044)
bestand Build, APK-Prüfung, Installation und Start. Beide Diagnoseerfassungen
meldeten keine Fehler. Wiedergabe, Seek in beiden Zuständen, Waveform-Pixelprüfung,
Trackwechsel und der erste Queue-Drag bestanden. Der nächste Reihenfolgevergleich
scheiterte an vermischten UI-Aufnahmen: C wurde noch auf y=223 gelesen, B später
ebenfalls auf y=223. Die abschließende XML-Aufnahme und der Screenshot zeigen
korrekt C/B/A auf y=134/223/313. Es wurden kein App-Fatal, ErrorBoundary-Fehler
oder abgewiesener nativer Queue-Drag in den erfassten Logs gefunden.

Die Reihenfolgeprüfung liest jetzt alle Zeilen aus derselben Aufnahme und
wartet begrenzt auf eindeutige, nicht überlappende Zeilen. Das gilt auch für
Playlist-Reorders. Vier Python-Fälle prüfen den Aufnahmewechsel, die laufende
Animation, eine bleibend falsche Reihenfolge und doppelte Zeilen-IDs. Drei davon
schlugen am vorherigen Testcode fehl; anschließend bestanden alle sieben
Python-Tests einschließlich Diagnosefehlern. Der vollständige Gerätetest muss
mit der korrigierten Prüfung erneut laufen.

Kalte PCM-Zeiten dieses Laufs: 0,482 / 5,814 / 19,163 Sekunden; Cache-Treffer
0 ms, Hydration 4,336 Sekunden. Das bestätigt weiterhin die Streuung der
Erstanalyse und ist kein Nachweis einer allgemeinen Ein-Sekunden-Latenz.

Beim Vorladen der Waveforms wurden zwei reproduzierbare Lücken gefunden:
Eine vor dem Start zurückgestellte Anfrage wurde ohne neue Library-Änderung
nicht wieder aufgenommen. Eine bereits laufende, vom Scheduler verdrängte
Anfrage wurde sogar als endgültig versucht markiert. Beide Fälle ließen den
Titel trotz späterer Leerlaufzeit ohne vorbereitete Waveform.

Der Scheduler-Abbruch wird jetzt von einer Kündigung durch den Aufrufer
unterschieden. Das Library-Vorladen setzt verdrängte oder zurückgestellte
Arbeit nach 1,5 Sekunden fort und prüft dabei erneut den Cache. Es bleibt
seriell, hält höchstens einen Wiederholungs-Timer und endet bei Wiedergabe,
Hintergrundwechsel oder Metadatenarbeit. Echte Decoderfehler werden weiterhin
nur einmal versucht; die angrenzenden Track-Preloads behalten ihr Verhalten.

Zwei Integrationstests mit dem echten JS-Scheduler und Cache schlugen zuerst
wegen der ausbleibenden Waveform fehl und bestanden nach der Korrektur.
Zwei weitere Fälle prüfen Abbruch des geplanten Wiederholungsversuchs und
einmaliges Behandeln echter Decoderfehler. Alle 71 betroffenen Tests, anschließend
die vollständige Coverage-Prüfung mit 318 Suites / 3.076 Tests sowie TypeScript,
ESLint und die Komplexitätsprüfung bestanden lokal.
Diese Korrektur vermeidet unnötige kalte Aufrufe nach verdrängtem Vorladen;
sie ändert weder den nativen Decoder noch dessen gemessene Laufzeit.

Die [erste CI für diesen Vorlade-Fix](https://github.com/k1w1-a0style/musik-player/actions/runs/36244729754)
stoppte vor den Tests an geänderten npm-Advisory-Source-IDs. Der erneute Audit
enthält dieselben zwei GHSAs für `image-size@1.2.1`, jetzt mit 1239766 bzw.
1239765. Die offizielle Advisory-Aktualisierung vom 24. September nennt 2.0.3
als gepatcht; npm bietet 2.0.4 an, aber keine gepatchte 1.x-Version. Metro 0.83.3
ruft weiterhin die entfernte synchrone Dateipfad-API auf. Ein erzwungener Wechsel
auf 2.x würde daher den Asset-Build brechen.
Die bestehende Ausnahme wurde nach Prüfung der identischen GHSAs auf die neuen
Source-IDs aktualisiert, mit unveränderter Paketversion und unverändertem
Ablaufdatum 20. November. Die Inhaltsprüfung blockiert weiterhin ICNS, HEIF,
JXL und JXL-Stream; ihr Test und die Audit-Policy-Tests bestanden (16 Tests).
Der aktuelle Audit besteht diese Policy mit 0 Critical, 1 dokumentierten High
und 3 Moderate-Einträgen. Die drei Moderate-Einträge gehen auf
`decode-uri-component` über `query-string` / `@react-navigation/core` zurück;
sie sind keine zusätzlichen Ausnahmefreigaben.

Quellen: [ICNS-Advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr),
[JXL/HEIF-Advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq),
veröffentlichte npm-Metadaten von `image-size@2.0.4` und der installierte
Metro-Asset-Code in `metro@0.83.3`.

Der ursprüngliche Decoder-Fix verändert nativen Code. Ein Metro-Reload der alten Development-APK reicht
nicht. Eine **neue Development-APK** wurde aus `950b4e18` gebaut und der erweiterte
Interaktionstest bestanden. Die zusätzlichen Fehlerpfad-Korrekturen betreffen
JavaScript. Der vorhandene manuelle
Build-Einstieg in `android-emulator-smoke.yml` bleibt erhalten: Branch `codex`, Eingabe
`BUILD_DEVELOPMENT_APK`. Es wurde kein Release-Build gestartet und kein Build-Gate geöffnet.

## Abschlussprüfung des fortgesetzten Arbeitsstands

Geprüfter Code: `08fe3fecd36e437169663d5faa2e0b7b4eea2aa5` auf `codex`.
Die [vollständige CI](https://github.com/k1w1-a0style/musik-player/actions/runs/36259235486)
bestand am 26. September: 318 Suites / 3.076 JavaScript-Tests mit Coverage,
125 native Tests und sieben Python-Tests. TypeScript, Lint, Komplexität,
Expo-Kompatibilität, Manifest- und Audit-Policy-Prüfung bestanden ebenfalls.

Der [Android-Lauf #36](https://github.com/k1w1-a0style/musik-player/actions/runs/36259516056)
verwendete denselben unveränderlichen Quellstand. Build, APK-Prüfung, Installation,
Start, Waveform-Pixeltest und Seek-Prüfungen bestanden. Der erste Queue-Vergleich
zeigte eine zu strenge Bedingung im neuen Test: Android meldete die korrekte
Reihenfolge A/C/B mit Grenzen 134–224, 223–312 und 313–402. Die ersten beiden
Zeilen überlappen damit in den gemeldeten Koordinaten um einen Pixel. Die Zeilen
sind 68 dp hoch, bei 210 dpi entspricht das 89,25 physischen Pixeln. Screenshot
und XML zeigen die korrekte Anordnung, beide Diagnoseerfassungen waren fehlerfrei.
Es wurden keine App-Fatals, ErrorBoundary- oder nativen Reorder-Fehler gefunden.

Die Prüfung erlaubt jetzt genau einen Pixel Grenzüberlappung und verlangt
zusätzlich streng geordnete Ober- und Unterkanten. Die exakten Android-Koordinaten
reproduzierten den Fehlschlag lokal vor der Korrektur. Ein zweiter neuer Fall
weist zwei Pixel Überlappung zurück. Anschließend bestanden alle neun Python-Tests;
falsche Reihenfolge, doppelte IDs und größere Animationsüberlappungen bleiben Fehler.
Der App-Code ist unverändert. Eine erneute vollständige Android-Abnahme steht aus.

Für den vorhandenen Ubuntu-/Termux-Checkout startet der Development-Client so:

```sh
cd ~/musik-player
git switch codex
git pull --ff-only origin codex
npm ci --no-audit --no-fund
EAS_BUILD_PROFILE=development EXPO_NO_TELEMETRY=1 npx expo start --dev-client --lan
```

Die neue Development-APK installieren und mit diesem Metro-Server verbinden.
`--clear` gehört nicht zum regulären Start; der vorhandene Metro-Cache bleibt nutzbar.
Der APK-/Emulator-Nachweis ersetzt keine Messung mit den eigenen Musikdateien auf
dem Galaxy A50. Besonders lange, noch ungecachte Dateien bleiben ein offener
Performance-Prüfpunkt.
