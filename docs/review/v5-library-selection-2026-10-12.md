# V5 Bibliotheksauswahl und Cleaner-Einstiege

Basis: `74af98a1d33a14e51aaa02598bcf9b5be0e48e25`. Paket ergänzt die laufende V3/V4-App; der manuelle Info-/ID3-Einstieg und normale Wiedergabe bleiben erhalten.

## Verhalten

- Langes Drücken auf eine SongCard oder Menü „Auswählen“ startet Checkbox-Auswahl. Tap wählt anschließend aus, ohne Playback auszulösen. „Auswahl beenden“ stellt normale Song-Taps wieder her.
- Anzahl, „Alle auf dieser Liste auswählen“, „Auswahl aufheben“ und „Tags bereinigen“ führen dieselben Song-IDs an den separaten `TagCleaner` weiter.
- Auswahl bleibt beim Filtern/Sortieren/Tabwechsel bestehen. Gelöschte IDs, ersetzte Quellen oder geänderte Datei-Revisionsbelege entfernen die betroffene Auswahl. Cover-/Titeländerung allein entfernt sie nicht.
- Canonical SAF-Dokument-Identität dedupliziert Tree-/Document-Aliase; Pfad-Groß-/Kleinschreibung bleibt bedeutend. Snapshot und ID-Arrays sind unveränderlich.
- Playlist-/Album-/Artist-/Genre-Zeilen haben ein Langdruck-Menü mit tatsächlicher eindeutiger Dateianzahl. Ordner öffnen einen rekursiven Einstieg; opaque/MediaStore-Zuordnung wird nicht geraten und erzeugt eine Warnung. Vorhandene Playlist- und Ordnerzuordnung wird nicht verändert.
- „Alle auf dieser Liste“ verwendet beim Playlist-Tab nur die enthaltenen Songs der tatsächlich dargestellten Playlists; beim Ordner-Tab nur beweisbare Ordner-Mitglieder. Stale virtuelle Zeilen zählen nicht als aktuelle Auswahlziele.
- PlaylistDetail hat einen eigenen 48-dp-Button mit eindeutiger Dateianzahl. Nicht mehr verfügbare Dateien werden nicht als Ziele angeboten.

## Integration

`LibraryScreenContent` erhält optional `selectionScope: LibrarySelectionScope`. `useLibraryController` liefert Songs, aktuelle Sichtmenge und bestehenden Navigationscallback über `useLibraryNavigationActions`; keine zusätzliche Navigation-Abhängigkeit in Host-Probes. Ohne Scope bleiben existierende Render-/SongCard-Verträge nutzbar.

Der root-owned Navigationsvertrag muss `TagCleaner: { songIds?: string[] } | undefined` registrieren, und der Cleaner-Screen muss vorhanden sein, bevor dieses Paket veröffentlicht wird. Diese Typdatei war nur eine lokale Testabhängigkeit und gehört nicht zu diesem Paket.

Gemeinsame Cleaner-Helfer sind `uniqueCleanerSongs`, `resolveCleanerFolderSelection` und `getCleanerUnresolvedSongIds` aus `utils/tagCleanerSelection.ts`, geliefert vom Cleaner-Paket. Diese Implementierung wird nicht doppelt in diesem Paket geliefert.

## Nachweise vom 12.10.2026

Node 22.23.3. `npm test -- --runInBand --silent components/__tests__/Library components/__tests__/SongCard screens/__tests__/PlaylistDetail.test.tsx hooks/__tests__/useLibrary utils/__tests__/librarySelectionStore.test.ts`: 52 Suites / 334 Tests bestanden, 16.111 s.

Fokussiert neue Auswahl-/Scope-Probes: 3 Suites / 14 Tests. Unter 50 realen memoisierten React-Zeilensubscribern rendert ein Checkbox-Toggle nach Aktivierung genau die betroffene Zeile neu. Eintritt in den Auswahlmodus aktualisiert erwartungsgemäß die sichtbaren Checkboxen.

TypeScript, vollständiges ESLint mit max-warnings=0, git diff --check und unverändertes Komplexitätsgate bestanden. Komplexitätsgate: 3821 Produktionsfunktionen; keine Ausnahmeregel/Baseline aufgeweicht.

Noch zu belegen: integrierter vollständiger Host-Lauf und öffentliche UI auf dem finalen APK, insbesondere 320 dp / Fontscale 2,0 / TalkBack und Zusammenspiel mit gemessenem Mini-Player-Inset. Host-Probes sind kein Hardware-Nachweis.
