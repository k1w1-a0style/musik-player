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

## Vorbedingungen

- Frischer codex-Stand gezogen
- Keine lokalen uncommitted changes
- Dev-APK wurde nach den Native-Fixes für AudioInfo und SAF-TagWriter neu gebaut
- Dev-APK auf echtem Android-Gerät installiert
- App-Daten optional sauber zurückgesetzt oder Ausgangszustand dokumentiert
- Testmusik mit mindestens 3 lokalen Titeln vorhanden
- Mindestens ein Titel mit Cover
- Mindestens ein Titel ohne Cover
- Optional ein großes Cover / große Audiodatei für Stabilitätstest
- SAF-Quelle verfügbar
- Lokale Datei-Quelle verfügbar
- SAF-MP3-Testdatei mit bestehender Berechtigung verfügbar

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
- [ ] SAF-MP3-Texttag-Speichern funktioniert mit bestehender Berechtigung und unterstütztem Layout
- [ ] SAF-Cover-Speichern bleibt sichtbar nicht verfügbar
- [ ] MP4/M4A-SAF-Speichern bleibt sichtbar nicht verfügbar
- [ ] Unsupported Layouts bleiben sichtbar nicht verfügbar
- [ ] Backup/Temp/Verify/Rollback-Verhalten zeigt keine beschädigte Datei
- [ ] Datei bleibt nach Tag/Cover-Änderung abspielbar
- [ ] AlbumArtist kann im Tag Editor gespeichert und nach Refresh wieder gelesen werden

## Storage / Hydration

- [ ] Library lädt nach Neustart
- [ ] Queue lädt nach Neustart
- [ ] CurrentSong lädt nach Neustart
- [ ] RepeatMode lädt nach Neustart
- [ ] EQ Settings laden nach Neustart
- [ ] Favoriten/Playlists laden nach Neustart
- [ ] Keine doppelten Queue-Einträge nach Neustart

## Fehler-/Crash-Log

| Bereich | Fehler beobachtet? | Log / Screenshot | Bewertung | Follow-up |
| --- | --- | --- | --- | --- |
| | | | | |

## Ergebnisentscheidung

- [ ] Bestanden
- [ ] Bestanden mit Hinweisen
- [ ] Fehlgeschlagen

Freigaberegeln:

Bestanden nur, wenn:

- keine Crashs
- Playback im Vordergrund stabil
- Background/Notification/Lockscreen geprüft
- Cover/Palette Smoke geprüft
- lokales Tag/Cover-Speichern geprüft
- SAF-MP3-Texttag-Speichern und nicht verfügbare SAF-Grenzen geprüft
- AlbumArtist und AudioInfo-Backfill geprüft
- keine unerwarteten Permissions
- keine Datenverlust-Anzeichen

Nicht release-ready, wenn:

- keine neue Dev-APK gebaut wurde
- falsche Commit-SHA getestet wurde
- Gerätetest nicht durchgeführt wurde
- Background/Notification/Lockscreen nicht geprüft wurde
- Native-Smoke für AudioInfo, Cover/Palette und SAF-TagWriter nicht geprüft wurde
