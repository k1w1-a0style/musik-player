# Eng begrenzte Diagnose: Song-Info bei 200 % Schrift

Stand: 16.10.2026. Ausgangs-Harness `6271b3000ade93e2fb627ea440aa01887aec4436`.

## Unabhängig bestätigte Ausgangslage

- Reguläre [CI 38844315073](https://github.com/k1w1-a0style/musik-player/actions/runs/38844315073) am Prüfcommit `26644d3a3d2396d8de323473fcf378670df6548c`: completed/success.
- [APK-Retest 38844390898](https://github.com/k1w1-a0style/musik-player/actions/runs/38844390898), Job 116791490275: completed/failure. Original-Artefakt **12024085233**, 43.008.870 Bytes, SHA256 `b28a56411251edad2a4815a0c32ae24e54d036a7750cabb3537c44b72d9515f5`. Vollständig heruntergeladen, Digest und ZIP-CRC geprüft.
- `retest-origin.json` ordnet die APK unverändert Source `ddcc7ec2fcb03f68720927c23b06996d59b24dd1` und SHA256 `2e11157f92a4b09ce39801375ab8f08da42ed3a24a21a7e5dde1b01606afbe2a` zu.
- Die Logs erreichen nach Sammlung/SAF, SoundCloud-Schriftprüfung, Resume, Hintergrund/Queue, Backup/Restore, Farben und Cleaner die UI-Matrix. `matrix-progress.json` enthält **25 verschiedene erfolgreiche Fälle**: 24 bei 100/130 % und 200 % dunkel/graphite/standard. Keine Freigabe des fehlgeschlagenen Gesamtlaufs.
- Fehler im nächsten Fall **200 %, dunkel, graphite, compact**: `Scrollable UI not reachable: song-card-info-1000000019`. `diagnostic-errors.json` ist `{}`. Der finale Screenshot zeigt die laufende Bibliothek.

## Tatsächlich beobachtete Ursache und Grenze

Die Original-Frames 460–483 dokumentieren 24 abwechselnde Scrollrichtungen. Der native vertikale Listenbereich ist `[12,529][468,723]`, also 194 px hoch. Der Mini-Player beginnt erst bei y=789 und verursacht hier keine zusätzliche Verdeckung. Die Info-Aktion wird abwechselnd oben und unten am Listen-Clip abgeschnitten:

| Originalbeleg | Info-Bounds | Befund |
|---|---|---|
| scroll-query-460.xml | [380,529][452,591] | 62 px, am oberen Clip |
| scroll-query-461.xml | [380,663][452,723] | 60 px, am unteren Clip |
| library-2.0-dark-graphite-standard.xml | [380,550][452,622] | 72 × 72 px, anderer bereits bestandener Dichtefall |

Der bisherige Treiber sendet in diesem kleinen Fenster schnelle 136-px-Wischgesten mit 300 ms. Die aufgezeichnete Gegenbewegung belegt Überschwingen; die Zielaktion ist lokalisiert, wird aber bei jedem Richtungswechsel übersprungen. Der Standard-Fall ist kein Beweis für den noch offenen Compact-Fall. Aus den vorhandenen Daten ist kein zusätzlicher produktiver Layoutfehler nachgewiesen.

## Eng begrenzte Korrektur und Regression

Nur der Testtreiber wird verändert: Sobald eine Song-Aktion bereits sichtbar, aber vom nativen Clip abgeschnitten ist, verwendet er die vorhandenen präzisen Gesten. Hier sind das 78 px bei 800 ms, innerhalb des tatsächlichen Owners und mit überlappenden Ansichten. Bei noch nicht lokalisierter Aktion bleibt die Suche unverändert.

Original-XMLs sind bytegleich unter `scripts/ci/fixtures/song-info-font2-*` gesichert. Regression mit beiden Clip-Richtungen: vor Korrektur rot (136 px / 300 ms statt 78 px / 800 ms), danach grün. Zusätzliche Gegenproben weisen dauerhaft abgeschnittene Ziele weiterhin ab und verlangen für den aufgezeichneten vollständig sichtbaren Standard-Fall keinerlei Geste. Alle **154 Python-Tests** sind grün, ohne Skips. Keine App-Quelle, Touchflächen-Grenze, Sichtbarkeitsprüfung, APK, Sicherheitsregel oder historische V5-Prüfung geändert.

## Noch ausstehender Nachweis

Die neue Geste ist auf den Original-Frames regressionsgeprüft. **Ein erfolgreicher Android-Nachlauf des korrigierten Compact-Falls ist noch nicht belegt.** Die elf noch fehlenden Matrixfälle und die neue APK-Gesamtabnahme bleiben offen; die 25 vorhandenen Fälle bleiben historische, exakt zugeordnete Nachweise. Kein erneuter APK-Build und kein erneuter vollständiger Android-Lauf für diese Diagnose gestartet. Nächster Gerätelauf soll zuerst ausschließlich 200 % / dark / graphite / compact auf derselben APK prüfen; kein neuer Gesamt-Scan.

## Gezielter Gerätelauf vorbereitet

Der Manifest-Retest unterstützt eine streng begrenzte Ausführungsdatei `apk-retest-execution.json` mit ausschließlich Version 1 / Modus `song-info-single`. Der Einzeltest durchläuft dieselbe Matrix-Implementierung mit exakt 200 % / dark / graphite / compact. Alle Geometrieprüfungen, echtes Öffnen des Song-Menüs und native FLAC-Wiedergabebestätigung bleiben aktiv. Das Ergebnis trägt `stage-only-passed` und `releaseAccepted: false`; es kann keine vollständige APK-Freigabe vortäuschen. 156 Python-Tests prüfen unter anderem die exakte Fallauswahl und Ablehnung unbekannter Ausführungsoptionen. Der Lauf baut keine APK und wiederholt keine vollständige CI.

Die Fortsetzung ist vorbereitet: exakt zehn weitere 200-%-Fälle, ohne Überschneidung mit den bisherigen 25 oder dem isolierten Compact-Einzelfall. Der unabhängige Prüfer `verifyApkContinuation.py` bestätigt bereits die 25 nativen Matrixzeugen, vier Formate mit realem Clock-Fortschritt, die vier SoundCloud-Schrift-/TrackInfo-Nachweise und die vollständige Funktionsstufen-Reihenfolge vor dem einzigen Matrixfehler. Noch keine neue Gerätefreigabe. 159 fokussierte Python-Prüfungen erfolgreich.

## Einzeltest erfolgreich – 26/36 nachgewiesen

[Android-Einzeltest 38867090788](https://github.com/k1w1-a0style/musik-player/actions/runs/38867090788) auf Harness `72a19aecc500addb6227d7a255a20c133001c3f6` ist vollständig erfolgreich. Original-Artefakt `12032061690`, 11.222.767 Bytes, SHA256 `d57c1e9672d62db842b609c391a653da98f3aa0ca84afd27039865d5ed5cdef6` heruntergeladen, CRC/Digest und APK-Zuordnung geprüft. Der einzige Fall 200 % / dark / graphite / compact hat Menü-Bounds `[380,606,452,678]` (48 × 48 dp), getrennte Play-/Menüflächen, vollständige Header-/Section-Aktionen und echte native FLAC-Wiedergabebestätigung. Original-PNG kritisch gesichtet: keine abgeschnittene Zielaktion. `diagnostic-errors.json` ist leer, keine App-FATAL/ANR. Einzeltest bleibt korrekt `stage-only-passed`, keine vollständige Freigabe. Der unabhängige Prüfer bestätigt 25 historische plus einen neuen Fall ohne Duplikate. Nächster Lauf ausschließlich zehn weitere Fälle; keine Wiederholung der bisherigen 26.
