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
- [ ] Tag Edit Size-Limit Smoke Test (zu große Dateien werden blockiert, bevor geschrieben wird)
- [ ] Cover Remove Smoke Test (`removeCover` funktioniert nur wenn verfügbar)
- [ ] content:// Block Smoke Test (Schreiben klar blockiert/read-only)
- [ ] MiniPlayer/NowPlaying Smoke Test (disabled states + Navigation)
- [ ] TrackInfo/TagEditor Smoke Test (fehlende Felder = „Nicht verfügbar“)

## Known limitations

- SAF/content:// Writes sind bewusst read-only; direkte SAF-Tag-Writes sind nicht implementiert
- Cover ersetzen nicht implementiert
- Visualizer/FFT release-safe deaktiviert/optional
- MP4/M4A Writes funktionieren nur für bekannte sichere Atom-Layouts
- Sehr große Dateien werden beim In-App-Tag-Schreiben blockiert
