# Unabhängiger Pre-Build-Gegencheck nach PR #379 — 2026-08-08

> Dieser Bericht ersetzt für den **aktuellen** Stand den historischen Bericht vom
> 2026-08-06. Er verändert dessen damalige Aussagen nicht rückwirkend.

## Scope und verifizierte Ausgangslage

- Repository: `k1w1-a0style/musik-player`
- verifizierter `origin/codex`-Ausgangs-SHA und Merge-Base: `6d028ff4e2bbdf466ead0101eb68ff25f9462ac2`
- PR #379: gemergt; geprüfter PR-Head `ee94eb865fcd233ef04cab8d11bc66b01c8ebb26`
- CI #1409: erfolgreich auf genau `ee94eb865fcd233ef04cab8d11bc66b01c8ebb26`
- zusätzlicher Push-Lauf CI #1410: erfolgreich auf dem Merge-SHA `6d028ff4e2bbdf466ead0101eb68ff25f9462ac2`
- erster Remote-Stand dieses Hardening-PRs: `1ea1e12bbf21857f3644e0ada42168fdbd164eff`
- CI #1411: vollständig erfolgreich auf exakt `1ea1e12bbf21857f3644e0ada42168fdbd164eff`
- beim Start: sauberer Working Tree, keine offenen Pull Requests, `HEAD == origin/codex`
- Arbeitsbranch: `c8sxdc-codex/durchfuhren-des-letzten-pre-build-gegenchecks`

Der Codex-Security-Pluginserver stellte in dieser Sitzung weder Ressourcen noch Templates
bereit. Ein echter `$codex-security:deep-security-scan` konnte deshalb nicht ausgeführt
werden; es wird ausdrücklich **kein** Deep-Scan-Erfolg behauptet. Stattdessen erfolgten
repositoryweite manuelle/adversariale Prüfungen und die vorhandenen statischen Gates.

## Befunde und Korrekturen

### P2 — vermeidbare High-Supply-Chain-Funde

**Ursache und Attack Path.** Die Ausnahmen behaupteten für `js-yaml` und `nanoid`, es gebe
noch keinen kompatiblen Patch. Das frische npm-Audit und die aktuellen GitHub-Advisories
widerlegten das: `js-yaml` 3.15.0/4.3.0 lagen exakt in den Bereichen der Sources 1138114/
1138115 (`GHSA-5p4m-2wfm-xmqj`), während 3.15.1/4.3.1 gepatcht sind. `nanoid` 3.3.16 lag
für Source 1138813 (`GHSA-2v37-7h3g-55p8`) unter 3.3.17. Die Pfade waren
`jest-expo -> babel-jest -> babel-plugin-istanbul -> @istanbuljs/load-nyc-config -> js-yaml`,
`expo -> @expo/cli -> @expo/xcpretty -> js-yaml` sowie React Navigation/PostCSS nach
`nanoid`. Das sind Tooling-/JS-Dependency-Pfade; kein Java/Kotlin-Code wird in die
Android-Runtime übernommen. Trotzdem konnte präparierter Tooling-Input die bekannten
CPU-/Endlosschleifen-DoS-Pfade erreichen.

**Fix und Regression.** Overrides und Lockfile wurden kompatibel auf `js-yaml` 3.15.1 und
4.3.1 sowie `nanoid` 3.3.18 aktualisiert; beide Ausnahmen wurden entfernt. Ein frisches
Production-Audit enthält danach nur noch `image-size` als Advisory-Root.

### P2 — Diagnose-Sanitizer wurde semantisch zu spät installiert

**Ursache und Attack Path.** `index.js` enthielt zwar den Installationsaufruf vor der
App-Registrierung, statische ES-Imports werden aber vor dem Modulrumpf ausgewertet.
Diagnosen aus `App`, Playback-Service oder deren transitiven Modulen konnten daher vor
der globalen Redaction entstehen und URI, Pfad, Titel oder Error-Inhalte offenlegen.

**Fix und Regression.** Der Entry Point lädt und installiert den Sanitizer jetzt als erste
geordnete Runtime-Abhängigkeit und lädt erst danach Expo, TrackPlayer, App und Service.
Der Policy-Test prüft explizit, dass kein statischer Import diese Grenze wieder umgeht.
Die bestehenden adversarialen Sanitizer-Tests decken `content://`, `file://`, Android- und
Windows-Pfade, Mediendateien, URLs, Bearer/API-Secrets, sensitive Objektfelder, Error ohne
Stack, Arrays/Objekte, Kreisreferenzen und Begrenzungen ab. Native Logs verwenden
`safeLogReference()` (SHA-256-Kurzreferenz plus Schema) und `safeLogType()` ohne Message.

### P3 — Audit-Ausnahmeidentität und Stale-Policy

**Ursache und Attack Path.** Numerische npm-Sources waren nicht an die GHSA-URL gebunden;
ein sachlich falscher `reason` oder vertauschter Tracker-Advisory konnte trotz gleicher
Zahl unentdeckt bleiben. Ungültige Kalendertage wurden lexikalisch akzeptiert und nicht
mehr verwendete Ausnahmen waren nur Warnungen.

**Fix und Regression.** Policy-Schema 2 bindet jede Source-ID an eine konkrete
`https://github.com/advisories/GHSA-*`-Identität, validiert echte Kalendertage, lehnt
unvollständige Lockfiles ab und macht stale Ausnahmen blockierend. Tests umfassen
unerwartete Roots, Source-/URL-/Severity-/Versionsänderung, mehrere Lock-Versionen,
abgelaufene/ungültige/stale Ausnahmen, Collapsing, Zyklen, fehlende Audit-Struktur und
fehlende Lock-Struktur.

### P3 — Checkout-Credentials und Workflow-Inventar

**Ursache und Attack Path.** Der normale CI-Checkout verließ sich auf den Default
`persist-credentials: true`. Der Job besitzt derzeit nur `contents: read`, daher war kein
unmittelbarer Write-Exploit bestätigt; bei späterer Permission-Erweiterung wäre das Token
aber unnötig für nachfolgende Lifecycle-/Testschritte verfügbar gewesen. Außerdem erfasste
der repositoryweite Workflow-Test nur `.yml`, nicht `.yaml`.

**Fix und Regression.** Auch CI setzt nun `persist-credentials: false`. Dynamische Tests
enumerieren sämtliche `.yml`/`.yaml`, verbieten GitHub-Expressions direkt in `run`, prüfen
immutable 40-stellige Pins aller externen Actions, alle Checkouts auf deaktivierte
Credentials und PR-Grenzen für Secret-/Write-Jobs. Alle neun aktuellen Workflows wurden
geprüft. Production bleibt exakt an den aktuellen `main`-Head gebunden; Development und
Preview verlangen Reachability; Secret-, Supabase-, EAS-, Keystore- und Autofix-Jobs laden
vor der Autorisierung keinen extern gewählten Branchcode.

## Supply-Chain-Endzustand

Frische reproduzierbare Installation und frisches `npm audit --omit=dev --json`:

- 0 Critical, 10 High, 0 Moderate (npm zählt neun kollabierte Expo/Metro-Effekte mit);
- genau ein High-Advisory-Root: `image-size` 1.2.1;
- Sources 1138808 / `GHSA-w3rx-r6r6-pgpr` und 1138809 /
  `GHSA-5p2g-fcmc-qvqq`, jeweils betroffen `<=2.0.2`, weiterhin ohne veröffentlichte
  gepatchte Version;
- Pfad: `expo 54.0.35 -> @expo/metro 54.2.0 -> metro 0.83.3 -> image-size 1.2.1`;
- Einsatz beim Metro-Bundling/Asset-Parsing; nicht als Java/Kotlin-Bibliothek in der
  Android-Runtime;
- einzige verbleibende Ausnahme: `image-size` 1.2.1, High, exakt diese beiden Sources/
  GHSAs, Ablauf **2026-08-15**; keine Verlängerung;
- `tar` ist exakt 7.5.22 über `expo -> @expo/cli -> tar`; der frühere Bereich `<=7.5.20`
  ist behoben, und der frische Audit enthält keinen `tar`-Fund.

Damit sind die Aussagen „kein kompatibler Fix“ für `js-yaml`/`nanoid` im damaligen
Trackerstand technisch überholt; die Pflege von Issue #234/#376/#378 erfolgt außerhalb
dieser repositoryseitigen Korrektur.

## Runtime-/Integrations-Gegencheck

Der Gegencheck stützt sich nicht nur auf alte Berichte: Produktionspfade und die zugehörigen
aktuellen Regressionstests wurden erneut für Waveform-Fingerprint/Kollision/Recovery,
SAF-Reads, Tag-Journal/Receipt/Operation-ID/Recovery und fail-closed lokale Writes,
Persistenzfehler, TrackPlayer-Ready, Queue-Hydration/Restart/Stale-State, Metadata-/Artwork-
Freigabe, Palette-Single-Flight, Timeout/Abort/Cancellation, Refresh/Backfill, Theme-/Skin-
Persistenz und Rapid-Switch-Ordering abgeglichen. Die vollständige Suite übt insbesondere
Rollback-, Timeout-, stale generation-, capacity-, readback- und resource-lifecycle-Pfade.
Es wurde kein weiterer reproduzierbarer P0/P1/P2/P3-Runtimefehler bestätigt. Das ist keine
Geräteaussage: herstellerspezifische Android-/SAF-/Restart-Pfade bleiben Issue #236.

## Complexity und Hygiene

- Ratchet unverändert: 44 Ausnahmen, davon 15 Complexity >15 und 29 reine
  Längenüberschreitungen bei Complexity <=15;
- keine Grenze erhöht und keine Baseline neu erzeugt;
- Gate prüfte 2478 Produktionsfunktionen; die neuen Policy-/Startup-Änderungen liegen in
  Test- bzw. Entry-/CI-Code und sind durch gezielte Regressionen abgedeckt;
- keine temporären PR-379-Bootstrap-/Diagnose-/Triggerdateien oder Backup-Artefakte im Diff;
  `k1w1-triggered-build.yml` ist ein produktiver, getesteter Dispatch-Workflow und kein
  vergessener Testtrigger;
- keine echten TODO/FIXME/HACK-Marker im Produktionsbaum gefunden.

## Technische Verifikation und bewusste Grenze

Lokal erfolgreich: frisches `npm ci`, Audit-Policy, Source-NUL, Typecheck, 296 Jest-Suites /
2716 Tests mit Coverage-Enforcement (92.45% Statements, 83.95% Branches), ESLint ohne
Warnings, Complexity, Expo-Release-Config und generiertes Manifest-/Permission-Gate.
Android-Prebuild wurde ausschließlich für native statische Checks ausgeführt. JDK 17 wurde
verifiziert. Der damalige lokale Kotlin/JUnit-Lauf konnte mangels installiertem Android SDK
nicht abschließen; diese lokale Containergrenze wurde anschließend durch GitHub Actions
aufgelöst: CI #1411 war auf exakt `1ea1e12bbf21857f3644e0ada42168fdbd164eff`
vollständig erfolgreich, einschließlich Kotlin Compile, nativer JVM/JUnit-Tests, Native
Gradle Enforcement und JUnit Execution Verification.

CI #1411 bestätigt ausschließlich diesen vorherigen SHA. Der vorliegende gezielte
Korrektur-Pass erzeugt einen neuen SHA; für ihn ist erneut Exact-Head-CI erforderlich und
dieser Bericht behauptet keinen vorweggenommenen grünen Lauf. Der Deep-Scan bleibt mangels
Plugin ebenfalls als nicht ausgeführter Nachweis sichtbar.

## Release-/Gerätegrenze

Keine APK, kein AAB, kein EAS Development-/Preview-/Production-Build, kein Emulator, keine
Installation und kein Deployment wurden ausgeführt. Issue #236 und echte Samsung-/Huawei-
Smokes bleiben vollständig offen; Unit- oder JVM-Tests ersetzen sie nicht.
