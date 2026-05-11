# Release Checklist

## Build Config
- [ ] `name` = `Kiwi`
- [ ] `scheme` = `musik-player`
- [ ] `slug` = `musik-player`
- [ ] Android package = `com.k1w1a0style.musikplayer`
- [ ] `newArchEnabled=false`

## Permissions
- [ ] `RECORD_AUDIO` ist nicht in Android Permissions
- [ ] `NSMicrophoneUsageDescription` ist nicht gesetzt
- [ ] Keine neuen Permissions hinzugefügt

## Smoke Tests
- [ ] Playback Smoke Test (Play/Pause/Next/Prev, keine Regression)
- [ ] Import/SAF Smoke Test (Import läuft, SAF-Ordnerauswahl verständlich)
- [ ] Tag Edit Smoke Test (Save/No-op/Error Zustände sichtbar)
- [ ] Cover Remove Smoke Test (`removeCover` funktioniert nur wenn verfügbar)
- [ ] content:// Block Smoke Test (Schreiben klar blockiert/read-only)
- [ ] MiniPlayer/NowPlaying Smoke Test (disabled states + Navigation)
- [ ] TrackInfo/TagEditor Smoke Test (fehlende Felder = „Nicht verfügbar“)

## Known limitations
- SAF/content:// Writes nicht implementiert
- Cover ersetzen nicht implementiert
- Visualizer/FFT release-safe deaktiviert/optional
- MP4 Track/Disc/Comment read parity ggf. noch offen
