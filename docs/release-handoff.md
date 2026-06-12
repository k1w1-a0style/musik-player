# Release Handoff codex → main

Diese Checkliste ist der finale, manuelle Handoff von `codex` nach `main`. GitHub/codex ist die Quelle der Wahrheit: lokale Ergebnisse sind nur gültig, wenn sie mit dem letzten Commit und den GitHub-Checks auf `codex` übereinstimmen.

## Voraussetzungen

Vor einem Merge von `codex` nach `main` müssen alle Punkte erfüllt sein:

- [ ] Keine offenen Pull Requests gegen `codex`.
- [ ] Der letzte `codex`-Commit hat einen grünen CI-Run auf GitHub.
- [ ] `npm ci --no-audit --no-fund` ist grün.
- [ ] `npm run lint:ci` ist grün.
- [ ] `npm run typecheck` ist grün.
- [ ] `npm test -- --runInBand` ist grün.
- [ ] `npm run test:coverage -- --runInBand` ist grün.
- [ ] Keine aktiven P1/P2 Review-Threads sind offen.
- [ ] Keine abgesenkte Coverage ohne dokumentierte Begründung.
- [ ] Keine destructive migration ist offen oder ungeklärt.

## Lokale Handoff-Kommandos

Die Befehle sind absichtlich prüfend und enthalten keinen automatischen Push oder Merge. Nach jedem Block die Ausgabe kontrollieren, bevor der nächste Schritt gestartet wird.

```bash
git switch codex
git pull --ff-only origin codex
HEAD_SHA="$(git rev-parse HEAD)"
git status --short

npm ci --no-audit --no-fund
npm run lint:ci
npm run typecheck
npm test -- --runInBand
npm run test:coverage -- --runInBand

gh pr list --base codex --state open
gh run list --workflow CI --commit "$HEAD_SHA" --limit 5
```

Erwartung:

- `git status --short` ist leer.
- `HEAD_SHA` entspricht dem aktuell gepullten `codex`-Commit.
- `gh pr list --base codex --state open` zeigt keine offenen PRs.
- `gh run list --workflow CI --commit "$HEAD_SHA" --limit 5` zeigt mindestens einen erfolgreichen CI-Run für genau diesen Commit.
- Nicht ausreichend sind ein grüner Run für irgendeinen anderen `codex`-Commit oder ein erfolgreicher Run eines anderen Workflows.
- Wenn kein erfolgreicher CI-Run für genau `$HEAD_SHA` im Workflow `CI` existiert, ist der Main-Handoff blockiert.
- Falls die installierte `gh`-Version `--commit` nicht unterstützt, muss eine gleichwertige GitHub-Abfrage verwendet werden, die zugleich commit-spezifisch (`$HEAD_SHA`) und workflow-spezifisch (`CI`) filtert, bevor der Handoff freigegeben wird.
- Falls GitHub und lokale Ausgabe abweichen, gilt GitHub/codex; die Abweichung muss vor dem Handoff geklärt werden.

## Pflicht-Smoke-Tests auf Android

Vor dem Main-Merge muss mindestens ein Android-Smoke auf einem echten Gerät oder Emulator dokumentiert sein:

- [ ] App startet ohne Crash.
- [ ] Gespeicherte Library lädt korrekt.
- [ ] Import aus MediaLibrary funktioniert.
- [ ] Import über SAF-Ordner funktioniert.
- [ ] Wiedergabe Start/Pause/Nächster/Vorheriger Titel funktioniert.
- [ ] Background-, Lockscreen- und Notification-Steuerung bleiben stabil.
- [ ] Warteschlange bleibt nach Library-Änderungen stabil.
- [ ] Hydration nach App-Neustart bleibt stabil.
- [ ] Favoriten und Playlists persistieren.
- [ ] Tag-Bearbeitung für unterstützte lokale `file://`-Titel funktioniert.
- [ ] `content://`-Titel bleiben für Tag-/Cover-Writes read-only.
- [ ] Empty URI wird vor Tag-/Cover-Writes blockiert.
- [ ] Große Dateien werden vor Write-Versuchen blockiert.
- [ ] Cover ersetzen/entfernen funktioniert nur für unterstützte schreibbare Titel.
- [ ] externes Cover ist nicht entfernbar.
- [ ] Cover cache cleanup inklusive `readDirectoryAsync` funktioniert.
- [ ] Das generierte Android-Manifest enthält keine Mikrofon-/Foto-/Video-Permissions.


## New-Architecture Android Dev-APK Smoke

New Architecture ist testweise für das Android-only-Projekt aktiviert. Der Status bleibt bis zu einem neuen Android Dev-Build und erfolgreichem Geräte-Smoke offen; ohne diesen Smoke ist der Handoff nicht release-ready.

- [ ] Dev-APK wurde nach New-Architecture-Aktivierung neu gebaut.
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

## EAS Preview/Release vorbereiten

EAS-Builds werden gezielt und manuell vorbereitet; sie sind kein automatisches PR-Gate.

```bash
npx eas whoami
npx expo config --json | jq -r '.name, .scheme, .slug, .android.package, .newArchEnabled'
npx expo config --json | jq '.android.permissions, .android.blockedPermissions, .ios.infoPlist.NSMicrophoneUsageDescription // empty'
```

Vor einem Preview- oder Release-Build prüfen:

- [ ] EAS Login ist korrekt.
- [ ] Expo App-Identität, Android Package und testweise `newArchEnabled=true` stimmen.
- [ ] Android Permissions enthalten keine neuen oder unerwarteten Berechtigungen; neue oder unerwartete Mikrofon-/Foto-/Video-Permissions blockieren den Main-Handoff.
- [ ] Der Cover-cache-cleanup Smoke-Check bleibt inklusive `readDirectoryAsync` dokumentiert.
- [ ] Preview-/Release-Profil und Build-Ziel wurden bewusst ausgewählt.
- [ ] Build-Link, Commit-SHA und Smoke-Test-Ergebnis werden im Release-Thread oder PR dokumentiert.

Manueller Start erst nach erfolgreichem Handoff-Check:

```bash
npx eas build --platform android --profile preview
```

## Bewusst nicht automatisiert

- Kein automatischer Merge von `codex` nach `main`.
- Keine automatische Main-Merge-Action.
- Keine erzwungenen EAS Preview- oder Release-Builds auf Pull Requests.
- Keine Änderungen an Secrets, EAS Credentials oder GitHub Environments.
- Der Supabase-Legacy-Workflow bleibt ein manueller Legacy-Bridge-Workflow.

## Main-Merge-Blocker

Ein Merge nach `main` ist blockiert, solange einer dieser Punkte zutrifft:

- Offene PRs gegen `codex` oder ungeklärte Review-Threads mit P1/P2-Priorität.
- Fehlender oder roter CI-Run auf dem letzten `codex`-Commit.
- Fehlende oder fehlgeschlagene lokale Gates: Install, Lint, Typecheck, Tests oder Coverage.
- Coverage wurde abgesenkt und nicht nachvollziehbar begründet.
- Android-Smoke-Test fehlt oder zeigt Regressionen, insbesondere nach der New-Architecture-Aktivierung, bei Empty-URI-Blocking, External-Cover-Remove-Blocking oder Cover-cache-cleanup inklusive `readDirectoryAsync`.
- EAS-/Expo-Konfiguration ist unklar, widersprüchlich oder nicht reproduzierbar.
- Neue oder unerwartete Mikrofon-/Foto-/Video-Permissions erscheinen in Expo Config oder generiertem Android-Manifest.
- Eine destructive migration ist offen, ungeklärt oder nicht rollback-fähig dokumentiert.
- Es gibt Abweichungen zwischen lokalem Stand und GitHub/codex, die nicht aufgelöst wurden.
