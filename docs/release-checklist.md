# Release Checklist

## Build Config

- [ ] `name` = `k1w1-Musik`
- [ ] `scheme` = `musik-player`
- [ ] `slug` = `musik-player`
- [ ] Android package = `com.k1w1a0style.musikplayer`
- [ ] `newArchEnabled=false` bleibt Release-/Rollback-Vorgabe, solange `react-native-track-player@4.1.2` im Einsatz ist
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

## DeepScan Readiness Snapshot

Die bisherigen DeepScan-Phasen sind im Projekt-Checklog zusammengefasst: [`PROJECT_CHECKLOG.md`](../PROJECT_CHECKLOG.md). Vor einem finalen Release bleibt der vollständige Aggregationslauf separat auszuführen; dieser Config-/Doku-Schritt ersetzt ihn nicht.

Abgedeckte Bereiche: Storage-Races, Cover/Base64/ID3, FileSystem/Tag-Write, ErrorBoundary/UX/A11y, CoverCache-Hashing, SAF-Timeout/Abort, Storage-API und Import-Filter.

Bewusst separat: i18n-Migration, finale New-Architecture-Freigabe nach Android Dev-Build/Geräte-Smoke, vollständiger finaler Gesamttest und langfristige Import-/Codec-Erweiterungen.

## New-Architecture Android Dev-APK Smoke

New Architecture ist im Release-/Rollback-Pfad deaktiviert. Diese Liste wird Pflicht, sobald New Architecture in einem separaten Opt-in-PR oder nach passendem Dependency-Upgrade testweise aktiviert wird; ohne echten Android Dev-Build und Geräte-Smoke bleibt der Status dann offen.

Details zum A0-Risikoaudit und zur Opt-in-Reihenfolge: [`docs/architecture/new-architecture-compatibility-audit.md`](./architecture/new-architecture-compatibility-audit.md).

- [ ] Dev-APK wurde nach einer künftigen New-Architecture-Aktivierung neu gebaut.
- [ ] App startet auf echtem Android-Gerät.
- [ ] Musikimport funktioniert.
- [ ] Wiedergabe Start/Pause/Nächster/Vorheriger Titel funktioniert.
- [ ] Background Playback bleibt stabil.
- [ ] Lockscreen-Steuerung funktioniert.
- [ ] Notification-Steuerung funktioniert.
- [ ] EQ-Modul initialisiert ohne Crash.
- [ ] Palette/Cover-Extraktion funktioniert ohne Crash.
- [ ] SAF/content:// bleibt read-only für Tag-/Cover-Writes.
- [ ] Tag-Bearbeitung für lokale file://-Titel funktioniert.
- [ ] Keine regressiven Permission-Änderungen im Android-Manifest.

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
- [ ] Wiedergabe Start/Pause/Nächster/Vorheriger Titel funktioniert.
- [ ] Warteschlange bleibt nach Library-Änderungen stabil.
- [ ] Hydration nach App-Neustart bleibt stabil.
- [ ] Favoriten persistieren.
- [ ] Playlists persistieren.

### Tag-/Cover-Flows

- [ ] Tag-Bearbeitung für unterstützten `file://`-Titel funktioniert.
- [ ] `content://` bleibt read-only.
- [ ] Empty URI wird blockiert.
- [ ] Große Datei wird vor Write blockiert.
- [ ] Cover ersetzen funktioniert für unterstützte schreibbare `file://`-Titel.
- [ ] Cover entfernen funktioniert für embedded/cached File-Cover.
- [ ] externes Cover ist nicht entfernbar.
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

Die konkrete Android-Dev-APK-Smoke-Report-Vorlage für codex steht unter [`docs/testing/android-dev-apk-smoke-report.md`](./testing/android-dev-apk-smoke-report.md).

- [ ] App startet ohne Crash
- [ ] Wiedergabe-Smoke-Test (Play/Pause/Next/Prev, keine Regression)
- [ ] Background/Lockscreen/Notification Smoke Test
- [ ] Bluetooth/Headset Controls Smoke Test, wenn verfügbar
- [ ] Repeat/Shuffle Restore Smoke Test nach App-Neustart
- [ ] Import/SAF Smoke Test (Import läuft, SAF-Ordnerauswahl verständlich)
- [ ] ID3 Smoke Test mit MP3 v2.2/v2.3/v2.4 lesen; v2.2 Textfelder müssen beim Import sichtbar sein
- [ ] Cover Smoke Test (embedded Cover wird angezeigt; zu große/ungültige Cover bleiben stabil)
- [ ] Tag-Bearbeitung-Smoke-Test (Save/No-op/Error Zustände sichtbar)
- [ ] Tag-Bearbeitung-Size-Limit-Smoke-Test (zu große Dateien werden blockiert, bevor geschrieben wird)
- [ ] Cover-entfernen-Smoke-Test (`removeCover` funktioniert nur für erkannte embedded/cached File-Cover, nicht für reine externe CoverInfo)
- [ ] Cover-ersetzen-Smoke-Test (unterstützter schreibbarer `file://`-Titel schreibt neues Cover; UI darf bis zum späteren Re-Scan zunächst die gewählte Cover-URI anzeigen)
- [ ] content:// Block Smoke Test (Schreiben klar blockiert/read-only)
- [ ] MiniPlayer/NowPlaying Smoke Test (disabled states + Navigation)
- [ ] TrackInfo/TagEditor-Smoke-Test (fehlende Felder = „Nicht verfügbar“)
- [ ] Equalizer Smoke Test (Status geräteabhängig/experimentell, kein falsches Versprechen)
- [ ] NowPlaying Smoke Test ohne Visualizer-Prompt/FFT-Anzeige

## Known limitations

- SAF/content:// Writes sind bewusst read-only; direkte SAF-Tag-Writes sind nicht implementiert
- Cover ersetzen ist nur für unterstützte schreibbare `file://`-Titel aktiv; nicht unterstützte Container bleiben blockiert
- MP4/M4A Cover-/Tag-Writes funktionieren nur für bekannte sichere Atom-Layouts
- Nach Cover ersetzen kann die UI zunächst die gewählte Cover-URI zeigen, bis ein späterer Re-Scan/extrahierter Cache eine stabilere eingebettete Cover-URI liefert
- Visualizer/FFT ist im Release-Pfad entfernt; native Android-Visualizer-API wird nicht verdrahtet
- Sehr große Dateien werden beim In-App-Tag-Schreiben blockiert
