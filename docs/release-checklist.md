# Release Checklist

## Build Config

- [ ] `name` = `Kiwi`
- [ ] `scheme` = `musik-player`
- [ ] `slug` = `musik-player`
- [ ] Android package = `com.k1w1a0style.musikplayer`
- [ ] `newArchEnabled=false`
- [ ] `expo.extra.eas.projectId` ist vorhanden

## Lokale Gates

```bash
npm ci --no-audit --no-fund
npm run typecheck -- --pretty false
npm test -- --runInBand
npm run lint:ci
npx expo config --json | jq -r '.name, .scheme, .slug, .android.package, .newArchEnabled'
npx expo config --json | jq '.android.permissions, .android.blockedPermissions, .ios.infoPlist.NSMicrophoneUsageDescription // empty'
```

- [ ] Typecheck grün
- [ ] Tests grün
- [ ] Lint grün; `lint:ci` darf Warnungen nicht verstecken
- [ ] Expo Config Werte stimmen

## CI-/Workflow-Sichtbarkeit

- [ ] Pull Requests gegen `codex` laufen durch den normalen CI-Workflow (`lint:ci`, `typecheck`, Tests, Coverage und Release-/Permission-Gates); bei failing CI keine Merge-Freigabe.
- [ ] `main` bleibt Haupt-/Release-Branch und bleibt ebenfalls durch CI für Pull Requests und Pushes abgedeckt.
- [ ] EAS- und Release-Builds bleiben separate, gezielt gestartete Workflows; sie werden nicht automatisch für jeden PR erzwungen.
- [ ] Der Supabase-Legacy-Workflow bleibt ein manueller Legacy-Bridge-Workflow und wird nicht automatisch ausgelöst.

## Final codex → main Release-Handoff

Details: [`docs/release-handoff.md`](./release-handoff.md)

Diese Handoff-Checkliste ist vor dem finalen Merge von `codex` nach `main` verbindlich und verweist auf die lokalen Gates, GitHub-Checks, Android-Smokes und bewusst manuellen EAS-Schritte.

## Round 8.6 Final Release-/Regression-Gates

Diese kompakte Abschlussliste ist das Release-Readiness-Minimum vor späteren Releases. Sie ergänzt die Detail-Checks unten; sie ersetzt keine manuelle Android-Prüfung nach SDK-/FileSystem-Änderungen.

### Quality Gates

```bash
npm ci --no-audit --no-fund
npm run lint:ci
npm run typecheck
npm test -- --runInBand
npm run test:coverage -- --runInBand
```

- [ ] Alle Quality Gates sind grün; Coverage wird nicht ohne Begründung abgesenkt.

### Runtime-Smoke-Flows

- [ ] App startet ohne Crash.
- [ ] Library lädt gespeicherte Songs.
- [ ] Import aus MediaLibrary funktioniert.
- [ ] Import aus SAF-Ordner funktioniert.
- [ ] Playback Start/Pause/Next/Previous funktioniert.
- [ ] Queue bleibt nach Library-Änderungen stabil.
- [ ] Hydration nach App-Neustart bleibt stabil.
- [ ] Favoriten persistieren.
- [ ] Playlists persistieren.

### Tag-/Cover-Flows

- [ ] Tag Edit für unterstützten `file://` Track funktioniert.
- [ ] `content://` bleibt read-only.
- [ ] Empty URI wird blockiert.
- [ ] Große Datei wird vor Write blockiert.
- [ ] Cover Replace funktioniert für unterstützte writable `file://` Tracks.
- [ ] Cover Remove funktioniert für embedded/cached File-Cover.
- [ ] External Cover ist nicht removable.
- [ ] Backup/Temp/Verify-Verhalten wurde manuell geprüft.

### Storage-/Legacy-Flows

- [ ] Raw `currentSongId` bleibt lesbar.
- [ ] Raw `eqPreset`/`repeatMode` bleiben lesbar.
- [ ] Raw boolean/number Settings bleiben lesbar.
- [ ] `albumArtist:null` bleibt nicht-destruktiv.
- [ ] Legacy `favorite`/`isFavorite` Migration bleibt ok.

### SDK-/FileSystem-Flows

- [ ] MediaLibrary Import funktioniert.
- [ ] SAF scan folder funktioniert.
- [ ] Cover cache write funktioniert.
- [ ] Cover cache cleanup inklusive `readDirectoryAsync` funktioniert.
- [ ] ID3/MP4 bounded reads funktionieren.
- [ ] TagWriter backup/temp/delete/getInfo funktioniert.

### Release-Blocker

- [ ] Keine aktiven P1/P2 Review-Threads offen.
- [ ] Kein failing Typecheck/Lint/Test/Coverage-Gate.
- [ ] Keine fehlende manuelle Android-Smoke-Prüfung nach SDK-/FileSystem-Änderung.
- [ ] Keine unklare destructive migration.
- [ ] Keine abgesenkte Coverage ohne Begründung.

## Permissions

- [ ] `RECORD_AUDIO` ist nicht in Android Permissions
- [ ] `NSMicrophoneUsageDescription` ist nicht gesetzt
- [ ] Keine neuen Permissions hinzugefügt
- [ ] Android enthält `READ_MEDIA_AUDIO`
- [ ] Android enthält `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
- [ ] Android blockiert Mikrofon-/Foto-/Video-Media-Permissions (`RECORD_AUDIO`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_VISUAL_USER_SELECTED`)
- [ ] Generiertes `AndroidManifest.xml` enthält keine Foto-/Video-/Mikrofon-Permissions

```bash
rm -rf android
npx expo prebuild --platform android --no-install --clean
npm run check:android-permissions
```

## Android Preview Build

Details: [`docs/android-preview-build.md`](./android-preview-build.md)

```bash
npx eas whoami
npx eas build --platform android --profile preview
```

- [ ] EAS Login geprüft
- [ ] Preview APK Build gestartet
- [ ] Build erfolgreich
- [ ] APK auf echtem Android-Gerät installiert
- [ ] Build-Link dokumentiert

## Smoke Tests

- [ ] App startet ohne Crash
- [ ] Playback Smoke Test (Play/Pause/Next/Prev, keine Regression)
- [ ] Background/Lockscreen/Notification Smoke Test
- [ ] Bluetooth/Headset Controls Smoke Test, wenn verfügbar
- [ ] Repeat/Shuffle Restore Smoke Test nach App-Neustart
- [ ] Import/SAF Smoke Test (Import läuft, SAF-Ordnerauswahl verständlich)
- [ ] ID3 Smoke Test mit MP3 v2.2/v2.3/v2.4 lesen; v2.2 Textfelder müssen beim Import sichtbar sein
- [ ] Cover Smoke Test (embedded Cover wird angezeigt; zu große/ungültige Cover bleiben stabil)
- [ ] Tag Edit Smoke Test (Save/No-op/Error Zustände sichtbar)
- [ ] Tag Edit Size-Limit Smoke Test (zu große Dateien werden blockiert, bevor geschrieben wird)
- [ ] Cover Remove Smoke Test (`removeCover` funktioniert nur für erkannte embedded/cached File-Cover, nicht für reine external CoverInfo)
- [ ] Cover Replace Smoke Test (unterstützter writable `file://` Track schreibt neues Cover; UI darf bis zum späteren Re-Scan zunächst die gewählte Cover-URI anzeigen)
- [ ] content:// Block Smoke Test (Schreiben klar blockiert/read-only)
- [ ] MiniPlayer/NowPlaying Smoke Test (disabled states + Navigation)
- [ ] TrackInfo/TagEditor Smoke Test (fehlende Felder = „Nicht verfügbar“)
- [ ] Equalizer Smoke Test (Status geräteabhängig/experimentell, kein falsches Versprechen)
- [ ] Visualizer Smoke Test (kein Mikrofon-Prompt; native FFT bleibt deaktivierter No-op)

## Known limitations

- SAF/content:// Writes sind bewusst read-only; direkte SAF-Tag-Writes sind nicht implementiert
- Cover ersetzen ist nur für unterstützte writable `file://` Tracks aktiv; unsupported Container bleiben blockiert
- MP4/M4A Cover-/Tag-Writes funktionieren nur für bekannte sichere Atom-Layouts
- Nach Cover Replace kann die UI zunächst die gewählte Cover-URI zeigen, bis ein späterer Re-Scan/extrahierter Cache eine stabilere eingebettete Cover-URI liefert
- Visualizer/FFT release-safe deaktiviert; native Android-Visualizer-API wird nicht verdrahtet
- Sehr große Dateien werden beim In-App-Tag-Schreiben blockiert
