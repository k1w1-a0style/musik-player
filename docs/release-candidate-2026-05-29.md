# Release Candidate — 2026-05-29

## Kurzfazit

Der aktuelle Stand ist nach den sieben Sanierungsrunden **releasefähig als Release Candidate**, sofern der anschließende Android-Preview-/Production-Build auf EAS ebenfalls erfolgreich durchläuft und die App auf einem echten Android-Gerät per Smoke-Test validiert wird.

Diese RC-Vorbereitung enthält bewusst **keine Architekturänderungen, keine neuen Dependencies, keine gelockerten ESLint-/TypeScript-Regeln, keine gelöschten Tests und keine Coverage-Absenkung**. Der Stand wurde nur geprüft und dokumentiert.

## Geprüfter Projektstand

- App/Expo-Konfiguration: `app.json` und `app.config.js` vorhanden; `app.config.js` ergänzt `expo.extra.eas.projectId` aus `eas-project.json`.
- App-Name/Slug/Scheme: `Kiwi` / `musik-player` / `musik-player`.
- Zielplattform: Android.
- React-Native-New-Architecture: `newArchEnabled=false` bleibt unverändert.
- Android Package Name: `com.k1w1a0style.musikplayer`.
- Versionierung im Repo: `package.json` und `app.json` stehen auf `1.0.0`.
- Android `versionCode` und iOS/Android `buildNumber` sind nicht im Repo gesetzt; `eas.json` nutzt `cli.appVersionSource=remote`. Die Store-/APK-Buildnummer muss daher vor Production manuell in EAS bestätigt werden.
- EAS-Profile: `preview`, `production` und `development` erzeugen Android-APKs; `preview` und `development` laufen ohne Credentials, `production` nutzt Credentials/Secrets.
- Build-relevante Assets vorhanden: `assets/icon.png`, `assets/adaptive-icon.png`, `assets/splash.png`, `assets/favicon.png`.
- README und Release-Dokumentation vorhanden: `README.md`, `docs/release-checklist.md`, `docs/android-preview-build.md`.
- Final Deep Review vorhanden: `docs/final-deep-review-2026-05-29.md`.
- CI vorhanden: `.github/workflows/ci.yml` führt Install, Typecheck, Tests, Lint, Expo-Config-Gate und generierten Android-Manifest-Permission-Gate aus. Zusätzlich existieren EAS-/Release-Build-Workflows.

## Gemergte Qualitätsrunden

Der RC-Stand baut auf folgenden gemergten Sanierungsrunden und Follow-ups auf:

1. Runde 1: Quality Gates / ESLint / Dependencies / Coverage
2. Runde 2: Playback Stability / PlayableSong
3. Runde 3: Native Queue Sync / Library Remove / Hydration
4. Runde 4: Import-/Refresh-Cancellation
5. Runde 5: Tagging / Cover Picker / Android Permissions / tagWriter
6. Follow-up: Empty URI Planning Fix
7. Runde 6: Library Presentation / Album Keys / Performance / ErrorBoundaries
8. Follow-up: Screen-Hooks innerhalb ErrorBoundaries
9. Runde 7: Final Deep Review / Regression Scan / Favorite Flow Hardening

## Bekannte Fix-Bereiche

- Playback-Stabilität durch `PlayableSong`-Normalisierung, robuste Queue-Planung und Schutz vor leeren/ungültigen URIs.
- Native Queue Sync und Current-Song-Sync nach Hydration, Library-Remove und Queue-Änderungen.
- Hydration-Fallbacks bei Storage-/Sanitizing-Fehlern ohne destruktives Überschreiben gespeicherter Songs.
- Import- und Metadata-Refresh-Flows mit Cancellation, Timeout-Handling und latest-wins-Schutz.
- TagWriter-Flow mit kontrollierten Fehlercodes, URI-Prüfung, Size-/Verification-Checks und SAF/content-URI-Schutz.
- Cover Picker mit kontrollierten Cancel-/Permission-/Invalid-Asset-Pfaden.
- Android-Permissions ohne Mikrofon-/Bild-/Video-Freigaben im Release-Gate.
- Library-Präsentation mit stabilen Album-/Artist-/Song-Keys, besseren Listeneigenschaften und ErrorBoundaries.
- Favorite-Flow-Hardening im Now-Playing-Screen inklusive kontrollierter Storage-Fehlerbehandlung.

## Getestete Quality Gates

Am 2026-05-29 wurden exakt die geforderten lokalen Gates ausgeführt:

```sh
npm ci --no-audit --no-fund
npm run lint:ci
npm run typecheck
npm test -- --runInBand
npm run test:coverage -- --runInBand
```

Ergebnis:

- `npm ci --no-audit --no-fund`: bestanden; `react-native-track-player@4.1.2`-Postinstall-Patch wurde angewendet.
- `npm run lint:ci`: bestanden ohne ESLint-Warnungen.
- `npm run typecheck`: bestanden.
- `npm test -- --runInBand`: bestanden, 175 Test-Suites / 1204 Tests.
- `npm run test:coverage -- --runInBand`: bestanden, 175 Test-Suites / 1204 Tests; Gesamt-Coverage: 92.53% Statements, 84.31% Branches, 96.36% Functions, 94.09% Lines.

## Build-Script-/Build-Konfigurationsstatus

- Es gibt kein dediziertes `npm run build`-Script in `package.json`.
- Der lokale Android-Start erfolgt über `npm run android` (`expo start --android`) und ist kein Release-Build.
- Release-/Preview-Builds sind über EAS dokumentiert und konfiguriert.
- Ein EAS-Build wurde in dieser RC-Dokumentationsrunde nicht gestartet, weil er remote läuft und EAS-Login/Secrets/Credentials erfordert.

## Empfohlener nächster Build-Befehl

Für den Release-Candidate-Artefakt zuerst einen Preview-APK-Build erzeugen:

```sh
npx eas build --platform android --profile preview
```

Für den finalen Production-Kandidaten danach den vorhandenen Release-Build-Workflow bzw. EAS-Production-Build verwenden, nachdem Version/Buildnummer und Credentials bestätigt wurden:

```sh
npx eas build --platform android --profile production
```

## Bekannte Restrisiken

- `versionCode`/Buildnummer wird wegen `cli.appVersionSource=remote` nicht im Repo festgelegt. Vor Store-/APK-Release muss die aktuelle EAS-Remote-Version manuell bestätigt werden.
- Der tatsächliche EAS-Preview-/Production-Build wurde lokal nicht ausgeführt; mögliche remote Credential-, Keystore- oder EAS-Service-Probleme sind daher nicht ausgeschlossen.
- Android-Manifest-Permissions werden in CI per generiertem Prebuild geprüft; lokal wurde in dieser Runde kein zusätzlicher Prebuild-Gate ausgeführt, weil die geforderten fünf Quality Gates unverändert im Fokus standen.
- Die Tests enthalten erwartete Warn-/Fehlerausgaben für kontrollierte Failure-Pfade (z. B. TagWriter, Import-Cancellation, Cover Picker, Playback-Ende). Diese sind keine fehlgeschlagenen Tests, sollten aber bei manuellen Smoke-Tests nicht mit neuen Runtime-Problemen verwechselt werden.
- Native Audio-/Playback-Verhalten muss weiterhin auf echten Android-Geräten validiert werden, insbesondere Medienberechtigungen, Hintergrund-Playback, Queue-Sync, Tagging auf realen Dateien und Import großer Libraries.

## Empfehlung

**Releasefähig als Release Candidate.**

Nicht direkt blind als Store-/Production-Release ausliefern: Vor dem finalen Release müssen mindestens der empfohlene EAS-Preview-Build, ein Smoke-Test auf echter Android-Hardware und die manuelle Bestätigung der EAS-Remote-Version/Buildnummer abgeschlossen werden.
