# Gepinnte Abhängigkeiten und lokale Payload-Patches

Stand 16.10.2026. F12 ist eine bewusste Wartungsgrenze, kein Anlass für einen ungezielten Backend-Umbau. F10 ist der dokumentierte, getestete begrenzte App-Vertrag in [modules/playback-backend/README.md](../modules/playback-backend/README.md).

## Verbindliche Upgrade-Reihenfolge

1. Isoliertes Arbeitspaket auf dem erlaubten Arbeitsbranch; keine gleichzeitigen schreibenden Agenten. Ausgangs-SHA, Lockfile und unveränderte freigegebene APK sichern. `main` und V5-Originale bleiben unverändert.
2. Veröffentlichte kompatible Upstream-Version, Advisory und tatsächlichen Abhängigkeitspfad prüfen. Bei RN-/Expo-/Player-Majorwechsel eigener Migrationsumfang; kein `npm audit fix --force` und kein ungeprüftes Override.
3. Frisches `npm ci` ohne vorhandenes `node_modules`. Der Postinstall führt `patchRntpV5.cjs` und `patchToolingSecurity.cjs` aus. Unbekannte Version, geänderter Upstream-Hash, mehrdeutiger Patchanker oder manipuliertes Payload müssen den Install abbrechen. Nicht durch Aktualisierung erwarteter Hashes „reparieren“, bevor der komplette geänderte Upstream-Code und die nötige Garantie geprüft wurden.
4. RNTP: `scripts/patches/rntp-v5/patches.json` bindet vier echte Upstream-/Ziel-Dateien an SHA256. Vor jeglicher Mutation werden alle Dateien vorbereitet und geprüft. Die nativen Tests in `rntp-v5/tests/ControllerAcknowledgementTest.kt` müssen weiterhin Fence-/Ordering-/Nichtabschluss-/Fehler-Verhalten beweisen. Nicht auf ein zurückkehrendes V5-`void` als ACK umstellen und keine Deadline hinzufügen, die einen noch laufenden Writer freigibt.
5. Tooling-Sicherheit: `tooling-security/patches.json` bindet Version, vollständigen zulässigen Paketbestand, Payload- und Ziel-Hashes. Corpus-Fälle, Parserbudgets, Forge-PKCS12-Grenzen sowie Schatten-/Zusatzdatei-/Symlink-/Versions-/Tamper-Negativtests erhalten. Wenn Upstream einen Patch ersetzt, dessen Regressionen gegen den ungepatchten Vorgänger rot und gegen die neue veröffentlichte Version grün nachweisen; lokale Kompensation erst dann fachlich entfernen.
6. Audit-JSON neu erzeugen und mit der strengen Policy bewerten. Advisory-Zahl, Root-/Effect-Graph, Lockfile und installierte Bytes unterscheiden. Ein lokaler Backport beseitigt die npm-Advisory nicht. Abgelaufene Ausnahmen dürfen nicht stillschweigend verlängert oder durch Umbenennung/Abschwächung verborgen werden; echte Fristlösung oder ausdrücklich datierte Owner-Entscheidung erforderlich. Issue #396 und Bericht synchron halten.
7. Android-Hermes mit Source Maps exportieren und `checkAndroidBundleDependencies.cjs` ausführen. Braces/Forge müssen aus dem Runtime-Quellgraph ausgeschlossen bleiben. Host-/Tooling-Audit ist keine APK-Runtime-Analyse.
8. Gezielte Tests, Typecheck und Lint; anschließend einmal integrierte Quality-/Coverage-/Security-/Native-CI. Produktive/native Änderungen erfordern neue APK, Hash-/Signatur-/Manifestprüfung und vollständige eigene Android-Abnahme. Ein reiner Treiber-/Dokumentationswechsel darf die strikt zugeordnete bestehende APK über den Manifest-Retest verwenden. Quellen/Hash niemals rückwirkend auf historische V5-Beweise umetikettieren.
9. Commit-/Gate-/APK-Manifest und bekannte externe Grenzen dokumentieren. Erst nach grünen Nachweisen kann das konkrete Paket freigegeben werden. Öffentlicher Produktionsrelease/Main-Merge benötigen weiterhin gesonderte ausdrückliche Freigabe.

## Gezielte Prüfbefehle

```bash
npx --no-install jest modules/playback-backend/__tests__ scripts/patches/__tests__/patchRntpV5.test.ts scripts/patches/__tests__/patchToolingSecurity.test.ts scripts/ci/__tests__/checkNpmAudit.test.ts scripts/ci/__tests__/checkAndroidBundleDependencies.test.ts --runInBand
node scripts/patches/tooling-security/regressionCases.cjs
npm audit --omit=dev --json > npm-audit-production.json
node scripts/ci/checkNpmAudit.cjs npm-audit-production.json security/npm-audit-exceptions.json package-lock.json
CI=1 npx --no-install expo export --platform android --source-maps --output-dir ci-android-export
node scripts/ci/checkAndroidBundleDependencies.cjs ci-android-export
```

Vor einem Upgrade die aktuellen Aufrufverträge der Skripte prüfen. Das Audit kann wegen der bekannten Advisory mit Exitcode 1 enden; nur die anschließende vollständige Policy-Auswertung entscheidet über das Gate, nicht ein unterdrückter Audit-Exitcode. Historischer, frisch bestätigter Ausgangsbestand: [Patch-Manifest](review/evidence/v4-patch-baseline.json), [F01-Neuprüfung](review/v4-security-recheck.md).
