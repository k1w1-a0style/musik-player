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
- Ergebnis: offen / bestanden / blockiert / fehlgeschlagen

## Vorbedingungen

- Frischer codex-Stand gezogen
- Keine lokalen uncommitted changes
- Dev-APK wurde nach N-25 Native-Fix neu gebaut
- Dev-APK auf echtem Android-Gerät installiert
- App-Daten optional sauber zurückgesetzt oder Ausgangszustand dokumentiert
- Testmusik mit mindestens 3 lokalen Titeln vorhanden
- Mindestens ein Titel mit Cover
- Mindestens ein Titel ohne Cover
- Optional ein großes Cover / große Audiodatei für Stabilitätstest
- SAF-/content:// Quelle verfügbar
- file:// lokale Quelle verfügbar

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

## Cover / Palette / N-25 Native Bitmap Decode

- [ ] Cover wird angezeigt
- [ ] Titel ohne Cover bleibt stabil
- [ ] Palette/Cover-Farbe wird ohne Crash extrahiert
- [ ] Großes Cover verursacht keinen Crash/OOM
- [ ] Defektes/ungültiges Cover verursacht keinen Crash
- [ ] Remote-URI bleibt blockiert, falls testbar
- [ ] Embedded Artwork Cache funktioniert
- [ ] App-Neustart nach Cover-Cache bleibt stabil

## Tag-/Cover-Write-Flows

- [ ] Tag-Bearbeitung für lokale file:// Datei funktioniert
- [ ] Cover ersetzen für lokale file:// Datei funktioniert
- [ ] Cover entfernen für lokale file:// Datei funktioniert
- [ ] content:// bleibt read-only
- [ ] SAF/content:// Write-Versuch wird sauber blockiert
- [ ] Backup/Temp/Verify/Rollback-Verhalten zeigt keine kaputte Datei
- [ ] Datei bleibt nach Tag/Cover-Write abspielbar

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
- [ ] Blockiert
- [ ] Fehlgeschlagen

Freigaberegeln:

Bestanden nur, wenn:

- keine Crashs
- Playback im Vordergrund stabil
- Background/Notification/Lockscreen geprüft
- N-25 Cover/Palette Smoke geprüft
- file:// Tag/Cover-Write geprüft
- content:// read-only geprüft
- keine unerwarteten Permissions
- keine Datenverlust-Anzeichen

Blockiert, wenn:

- keine neue Dev-APK gebaut wurde
- falsche Commit-SHA getestet wurde
- Gerätetest nicht durchgeführt wurde
- Background/Notification/Lockscreen nicht geprüft wurde
- N-25 Native-Smoke nicht geprüft wurde
