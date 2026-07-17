# Android Dev-APK Smoke Report

## Status

- Smoke-Typ: Android Dev-APK / Dev Client
- New Architecture: disabled / `newArchEnabled=false`
- Zielbranch: codex
- Commit-SHA: manuell eintragen
- Build-Link oder Build-ID: manuell eintragen
- Gerät: manuell eintragen
- Android-Version: manuell eintragen
- Datum/Uhrzeit: manuell eintragen
- Ergebnis: offen / bestanden / mit Hinweisen / fehlgeschlagen
- Theme-Migration: code-seitig abgeschlossen; echter Dark/Light/Skin-Geräte-Smoke offen

## Vorbedingungen

- Frischer codex-Stand gezogen
- Keine lokalen uncommitted changes
- Dev-APK wurde nach den Native-Fixes für AudioInfo und SAF-TagWriter neu gebaut
- Dev-APK wurde nach der Theme-Migration aus dem getesteten Commit neu gebaut
- Dev-APK auf echtem Android-Gerät installiert
- App-Daten optional sauber zurückgesetzt oder Ausgangszustand dokumentiert
- Testmusik mit mindestens 3 lokalen Titeln vorhanden
- Mindestens ein Titel mit Cover
- Mindestens ein Titel ohne Cover
- Optional ein großes Cover / große Audiodatei für Stabilitätstest
- SAF-Quelle verfügbar
- Lokale Datei-Quelle verfügbar
- SAF-MP3-Testdatei mit bestehender persisted Write-Permission und Provider-Writable-Flags verfügbar
- SAF-M4A- oder SAF-MP4-Testdatei mit bestehender persisted Write-Permission und Provider-Writable-Flags verfügbar
- Testcover zum Hinzufügen/Ersetzen sowie mindestens ein entfernbares embedded Cover verfügbar
- Theme-Testzustände verfügbar: Graphite, Minimal und Neon Cover jeweils in Hell/Dunkel prüfen

## Build-/Config-Prüfung

Checkliste:

- [ ] `newArchEnabled=false`
- [ ] Android Package korrekt
- [ ] Keine Mikrofon-Permission
- [ ] Keine Foto-/Video-Permissions
- [ ] Audio-/Foreground-Service-Permissions korrekt
- [ ] Dev-APK passt zur getesteten Commit-SHA
- [ ] Keine unerwarteten Runtime-Permission-Prompts

## App-Start / Grundfunktion

- [ ] App startet ohne Crash
- [ ] Navigation lädt
- [ ] Library Screen lädt
- [ ] Now Playing Screen öffnet
- [ ] Settings/Modal-Flows öffnen und schließen
- [ ] Keine roten Fehler-Screens
- [ ] Keine auffälligen JS- oder Native-Crashes

## Theme / Settings / Dark-Light-Skins

- [ ] Settings-Screen öffnet aus dem Library-Menü
- [ ] Appearance-Wechsel `Dunkel` → `Hell` funktioniert ohne Crash
- [ ] Appearance-Wechsel `Hell` → `Dunkel` funktioniert ohne Crash
- [ ] Skin-Wechsel `Graphite` funktioniert ohne Crash
- [ ] Skin-Wechsel `Minimal` funktioniert ohne Crash
- [ ] Skin-Wechsel `Neon Cover` funktioniert ohne Crash
- [ ] Appearance und Skin bleiben nach Navigation zwischen Library, Now Playing, TrackInfo, TagEditor, Equalizer und PlaylistDetail erhalten
- [ ] Appearance und Skin bleiben nach echtem App-Neustart erhalten
- [ ] StatusBar und NavigationTheme passen zu Hell/Dunkel
- [ ] Library, Suche, Tabs, Sortierung, Songs, Alben, Playlists und Importstatus sind in Hell/Dunkel lesbar
- [ ] MiniPlayer ist in Hell/Dunkel lesbar und bleibt bedienbar
- [ ] NowPlaying, Queue, Waveform, Menü und Sleep-Timer-Menü sind in Hell/Dunkel lesbar
- [ ] Cover-/Palette-Akzent bleibt bei Player, Queue und Waveform sichtbar, ohne Grundflächen unlesbar einzufärben
- [ ] TagEditor-Felder, Hinweise, Buttons und CoverControls sind in Hell/Dunkel lesbar
- [ ] SAF/content-Blockadehinweise bleiben sichtbar und verständlich
- [ ] TrackInfo-Zeilen, Sektionen und Actions sind in Hell/Dunkel lesbar
- [ ] Equalizer-Header, StatusCard, Presets, Slider und CurveChart sind in Hell/Dunkel lesbar
- [ ] PlaylistDetail, PlaylistCreateForm und PlaylistListItem sind in Hell/Dunkel lesbar
- [ ] Modals/Overlays behalten ausreichenden Kontrast
- [ ] Neon Cover nutzt stärkere Akzente, ohne Grundflächen giftig/unlesbar zu machen
- [ ] Kleine Displays zeigen keine abgeschnittenen Settings-/Theme-Controls
- [ ] Keine Theme-bedingten Layout-Sprünge, Touch-Zonenverluste oder unlesbaren disabled states

## Import / Library

- [ ] MediaLibrary-Import funktioniert
- [ ] SAF-Ordnerimport funktioniert
- [ ] Sehr kurze Audio-Dateien werden gemäß Config behandelt
- [ ] Doppelte Imports erzeugen keine kaputte Library
- [ ] Library bleibt nach App-Neustart erhalten
- [ ] Favoriten persistieren
- [ ] Playlists persistieren
- [ ] AlbumArtist-Anzeige und Album-Gruppierung funktionieren
- [ ] AudioInfo-Backfill ergänzt bestehende Titel ohne Dauer/Bitrate/SampleRate/Channels
- [ ] AudioInfo-Backfill überschreibt vorhandene positive Werte nicht

## Playback / TrackPlayer V4

- [ ] Titel startet im Vordergrund
- [ ] Play/Pause funktioniert
- [ ] Nächster Titel funktioniert
- [ ] Vorheriger Titel funktioniert
- [ ] Seek funktioniert
- [ ] Progress-Anzeige läuft stabil
- [ ] Repeat off/all/one funktioniert
- [ ] Shuffle funktioniert
- [ ] Queue bleibt nach Library-Änderungen stabil
- [ ] CurrentSong bleibt nach App-Neustart konsistent

## Background / Notification / Lockscreen

- [ ] Wiedergabe läuft im Hintergrund weiter oder stoppt gemäß erwarteter App-Policy
- [ ] Notification erscheint korrekt
- [ ] Notification Play/Pause funktioniert
- [ ] Notification Next/Previous funktioniert
- [ ] Tap auf Notification öffnet App korrekt
- [ ] Lockscreen Controls erscheinen
- [ ] Lockscreen Play/Pause funktioniert
- [ ] Lockscreen Next/Previous funktioniert
- [ ] Screen-Off-Test mindestens 2 Minuten stabil
- [ ] App-Wechsel-Test stabil
- [ ] App-Kill/Task-Removal-Verhalten entspricht Erwartung

## EQ / Custom Native Module

- [ ] EQ Screen öffnet ohne Crash
- [ ] EQ init funktioniert oder sauberer Fallback
- [ ] Preset ändern funktioniert
- [ ] Band-Level ändern funktioniert
- [ ] EQ deaktivieren funktioniert
- [ ] Playback bleibt nach EQ-Änderungen stabil

## Cover / Palette / Native Bitmap Decode

- [ ] Cover wird angezeigt
- [ ] Titel ohne Cover bleibt stabil
- [ ] Palette/Cover-Farbe wird ohne Crash extrahiert
- [ ] Großes Cover verursacht keinen Crash/OOM
- [ ] Defektes/ungültiges Cover verursacht keinen Crash
- [ ] Remote-URI bleibt sauber abgewiesen, falls testbar
- [ ] Embedded Artwork Cache funktioniert
- [ ] App-Neustart nach Cover-Cache bleibt stabil

## Tag-/Cover-/Metadata-Flows

- [ ] Tag-Bearbeitung für lokale Datei funktioniert
- [ ] Cover ersetzen für lokale Datei funktioniert
- [ ] Cover entfernen für lokale Datei funktioniert
- [ ] SAF-MP3-Texttag-Speichern funktioniert mit bestehender persisted Write-Permission, Provider-Writable-Flags und unterstütztem Layout
- [ ] SAF-MP3-Cover hinzufügen/ersetzen funktioniert mit bestehender persisted Write-Permission, Provider-Writable-Flags und unterstütztem Layout
- [ ] SAF-MP3-embedded-Cover entfernen funktioniert mit bestehender persisted Write-Permission, Provider-Writable-Flags und unterstütztem Layout
- [ ] SAF-M4A/MP4-Texttag-Speichern funktioniert mit bestehender persisted Write-Permission, Provider-Writable-Flags und sicherem Atom-Layout
- [ ] SAF-M4A/MP4-Cover hinzufügen/ersetzen/entfernen funktioniert mit bestehender persisted Write-Permission, Provider-Writable-Flags und sicher unterstütztem Atom-Layout
- [ ] MediaLibrary-`content://`, source-lose Planner-URIs, fehlende SAF-Grants und alte Native-Builds bleiben sichtbar blockiert
- [ ] Unsupported ID3-/MP4-Layouts bleiben sichtbar blockiert
- [ ] No-op-Speichern verändert die Datei nicht unnötig
- [ ] Backup/Write/Verify/Rollback/Restart-Recovery zeigt keine beschädigte Datei
- [ ] Datei bleibt nach Tag/Cover-Änderung abspielbar
- [ ] AlbumArtist kann im Tag Editor gespeichert und nach Refresh wieder gelesen werden

## Storage / Hydration

- [ ] Library lädt nach Neustart
- [ ] Queue lädt nach Neustart
- [ ] CurrentSong lädt nach Neustart
- [ ] RepeatMode lädt nach Neustart
- [ ] EQ Settings laden nach Neustart
- [ ] Favoriten/Playlists laden nach Neustart
- [ ] Appearance und Skin laden nach Neustart
- [ ] Keine doppelten Queue-Einträge nach Neustart

## Fehler-/Crash-Log

| Bereich | Fehler beobachtet? | Log / Screenshot | Bewertung | Follow-up |
| --- | --- | --- | --- | --- |
| Theme / Settings | | | | |
| Import / Library | | | | |
| Playback / Background | | | | |
| Tag / Metadata / SAF | | | | |
| EQ / Native Module | | | | |

## Ergebnisentscheidung

- [ ] Bestanden
- [ ] Bestanden mit Hinweisen
- [ ] Fehlgeschlagen

Freigaberegeln:

Bestanden nur, wenn:

- keine Crashs
- Playback im Vordergrund stabil
- Background/Notification/Lockscreen geprüft
- Theme Dark/Light/Skins inklusive Persistenz nach Neustart geprüft
- Cover/Palette Smoke geprüft
- lokales Tag/Cover-Speichern geprüft
- SAF-MP3/M4A/MP4 Texttag- und Cover-Writes für unterstützte Layouts geprüft
- MediaLibrary-, fehlende-Permission-, source-lose Planner- und unsupported-Layout-Grenzen geprüft
- Backup/Verify/Rollback/Restart-Recovery ohne Datenverlust-Anzeichen geprüft
- AlbumArtist und AudioInfo-Backfill geprüft
- keine unerwarteten Permissions
- keine Datenverlust-Anzeichen

Nicht release-ready, wenn:

- keine neue Dev-APK gebaut wurde
- falsche Commit-SHA getestet wurde
- Gerätetest nicht durchgeführt wurde
- Theme Dark/Light/Skins nicht auf echtem Gerät geprüft wurden
- Background/Notification/Lockscreen nicht geprüft wurde
- Native-Smoke für AudioInfo, Cover/Palette und SAF-TagWriter nicht geprüft wurde
