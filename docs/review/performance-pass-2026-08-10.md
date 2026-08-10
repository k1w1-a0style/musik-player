# Performance-Pass: Player, Suche und Listen

Datum: 10. August 2026  
Branch: `codex`  
Ausgangspunkt: Deep-Scan-Stand `7800b04`

## Ziel

Dieser Pass reduziert Arbeit auf den kritischen UI-Pfaden, ohne die Player-Semantik zu verändern: horizontales SoundCloud-Swipen, vertikales Schließen, Scrubbing/Vorspulen, Mini-Player-Fortschritt, große Bibliotheken, Warteschlangen, Cover-Decoding und Waveform-Cache.

Messwerte in FPS oder Millisekunden werden bewusst nicht geschätzt. Die Änderungen entfernen konkrete Render-, Decode-, GPU- und Storage-Arbeit; die reale Wirkung muss zusätzlich auf 60-Hz- und 120-Hz-Android-Geräten profiliert werden.

## Umgesetzte Optimierungen

| Bereich | Vorher | Änderung |
| --- | --- | --- |
| Mini-Player | Der gesamte Mini-Player abonnierte den 500-ms-Fortschritt und den breiten Music-Context. | Fortschritt sitzt in einem kleinen, isolierten Kind; Palette kommt aus dem schmalen Mini-Player-Context. Artwork, Text und Transport-Buttons rendern nicht mehr bei jedem Fortschrittstick. |
| Klassisches Cover-Swipen | Der vorhandene Swipe-Pfad war im klassischen Panel deaktiviert und seine Bewegung hing an JS-Respondern. | Der klassische Cover-Swipe ist mit Queue-Grenzen verdrahtet; `PanGestureHandler` und `Animated.event` bewegen ihn mit Native Driver. JS entscheidet erst am Gesture-Ende über Trackwechsel oder Rückfederung. |
| Klassischer Waveform-Scrubber | Jede Fingerbewegung setzte React-State und berechnete/reconciliierte die Farbe aller Waveform-Balken neu. | Zwei statische, memoized SVG-Layer; nur die Clip-Breite wird per `Animated.Value` bewegt. Zeit-/Preview-State wird auf 90 ms begrenzt, der native Seek bleibt ein einzelner Commit beim Loslassen. |
| SoundCloud-Scrubbing | Live-Zeitupdates konnten alle 50 ms React-Arbeit erzeugen. | Preview-Updates auf 90 ms begrenzt; Waveform-Bewegung und Track-Swipe bleiben native-driver-basiert. |
| SoundCloud-Artwork | Ein zweites vollflächiges, geblurtes Cover blieb auch beim Abspielen unsichtbar gemountet; Animationsknoten wurden erneut aufgebaut. | Geblurtes Cover existiert nur im Pause-Übergang; Bildquellen und kombinierte Animated-Knoten sind stabil memoized. Benachbarte Seiten führen keine Play/Pause-Artwork-Animationen aus. |
| Klassischer Hintergrund | Cover-`blurRadius` plus zusätzlicher vollflächiger `BlurView`. | Der zweite Live-Blur entfällt; Cover-Blur und Gradients bleiben erhalten. |
| Cover-Decoding | Kleine Zielbilder konnten ohne expliziten Resize-Hinweis und mit Android-Fade decodiert werden. | Häufige Cover in Mini-Player, Song-/Album-/Gruppenlisten, Queue und Player nutzen stabile Sources, `resizeMethod="resize"` und `fadeDuration={0}`. |
| Waveform-Cache | Jeder Cache-Write validierte den Index durch erneutes Auflisten und Lesen sämtlicher Payloads. | Einmalig validierter Index bleibt pro Prozess im Speicher; nachfolgende serialisierte Writes vermeiden den vollständigen Storage-Scan. Rollback- und 80-Einträge-Grenze bleiben bestehen. |
| Bibliothekssuche | Suchtext wurde pro Song und Tastendruck erneut aus Metadaten aufgebaut. | Suchtext wird je unverändertem Song-Objekt per `WeakMap` gecacht; Bibliotheksfilterung nutzt `useDeferredValue`, damit Texteingabe unter Last responsiv bleibt. |
| Lange Listen | Queue und Playlist-Listen durften relativ breite Renderfenster aufbauen. | Begrenzte Initial-/Batch-/Window-Werte reduzieren Mount-Spitzen und Bildspeicher bei langen Listen. |

## Erhaltene Funktionsregeln

- Während eines Drags wird kein wiederholtes natives `seekTo` ausgelöst.
- Beim Loslassen wird genau einmal auf die finale Position gesprungen.
- Abbruchpfade im SoundCloud-Gesture stellen den vorherigen Fortschritt wieder her.
- Horizontale Trackwechsel respektieren weiterhin beide Queue-Grenzen; vertikale Pager-Gesten bleiben durch den horizontalen Fail-Offset getrennt.
- Queue-Reihenfolge, Auto-Scroll und Drag-Reorder bleiben unverändert.
- Cover-Fehlerzustände und Fallbacks bleiben erhalten.
- `newArchEnabled=false` und React Native Track Player 4.1.2 bleiben unverändert.

## Regressionstests

Ergänzt beziehungsweise angepasst wurden Tests für:

- nativen klassischen Cover-Swipe samt deaktivierter Queue-Grenze,
- statische Waveform-Balken plus beweglichen Played-Clip,
- genau einen finalen Seek-Commit,
- isolierten Mini-Player-Context und Palette,
- nicht gemountetes Pause-Blur-Cover während SoundCloud-Wiedergabe,
- Wiederverwendung des Waveform-Cache-Index ohne erneuten Komplettscan,
- aktualisierte Context-Slices.

Der Push auf `codex` startet die vollständige bestehende CI mit TypeScript, Jest/Coverage, ESLint, Komplexitätsgrenze, Expo-Konfiguration, Manifestprüfung sowie Android-Kotlin-/Native-Tests. Es wird dadurch kein kostenpflichtiger APK-, AAB- oder EAS-Build gestartet.

## Noch erforderliche Geräteprüfung

Die automatischen Gates prüfen Korrektheit, aber keine echte Frame-Pacing- oder Audio-Latenz. Für den Abschluss von [Issue #234](https://github.com/k1w1-a0style/musik-player/issues/234) sollten mindestens folgende Szenarien auf echter Hardware gemessen werden:

1. SoundCloud-Track-Swipe auf 60 Hz und 120 Hz, jeweils mit großen lokalen Covers.
2. Mehrfaches Scrubbing über kurze und sehr lange Tracks; Kontrolle auf genau einen hörbaren Seek pro Loslassen.
3. Schnelles Scrollen in Bibliothek und Queue mit mindestens 1.000 Songs und vielen Covers.
4. Wechsel Play/Pause im SoundCloud-Modus, um Blur-Mount und Übergang zu prüfen.
5. Kalter und warmer Start der Waveform-Ansicht, um Cache-I/O und Generierungszeit zu vergleichen.
6. Android-Profiler: JS/UI-Frame-Drops, Speicher und Bild-Decodes während der obigen Abläufe.

## Technischer Trade-off

Der klassische Scrubber hält zwei statische SVG-Balkenlayer statt eines dynamisch eingefärbten Layers. Das erhöht die statische Zahl der SVG-Nodes geringfügig, entfernt dafür die wesentlich teurere React-Reconciliation aller Balken bei jeder Fingerbewegung. Für Scrubbing ist das der sinnvollere Pfad; die Geräteprüfung bestätigt abschließend das Frame-Pacing.
