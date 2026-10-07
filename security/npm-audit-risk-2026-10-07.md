# npm-Restrisiken und befristete Ausnahme — 2026-10-07

## Entscheidung und Gültigkeit

Die Sicherheitsfunde werden nicht durch `npm audit fix --force`, ein SDK-Major-Upgrade oder ein höheres Schweregrad-Limit verdeckt. Die kompatiblen Updates für `shell-quote` (1.12.0), `compression` (1.8.2) und `source-map-js` (1.2.2) sind im Lockfile enthalten. Zwei weiterhin ungepatchte High-Advisory-Wurzeln bleiben ausdrücklich offen.

Verantwortlich für Ersatz/Neubewertung ist der Repository-Maintainer. Nachverfolgung: [Issue #396](https://github.com/k1w1-a0style/musik-player/issues/396). Die maschinenlesbare Ausnahme in `npm-audit-exceptions.json` gilt nur für die angegebenen Versionen und Advisory-IDs und endet am **2026-10-21**. Neue High-/Critical-Advisories, andere Versionen und abgelaufene Ausnahmen lassen das Gate fehlschlagen. Eine Ausnahme ist kein behobener Sicherheitsfehler.

| Paket / exakte Version | Advisory | Abhängigkeit und Angriffsfläche | Begrenzung |
| --- | --- | --- | --- |
| `braces@3.0.3` | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), npm source `1240992` | Metro/Jest verwenden `micromatch` → `braces`. Tiefe Muster können den Node-Prozess beenden. | Keine Bibliotheks-/Player-Eingaben als Glob-Muster ausführen. Repository-Muster sind dennoch nicht vertrauenswürdig, wenn fremder Code ausgeführt wird. |
| `node-forge@1.4.0` | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), npm source `1240912` | Expo-CLI und Zertifikats-/Code-Signing-Tooling; fehlerhafte RSA-Signaturprüfung. | Keine fremden Zertifikats-/Signaturdaten in privilegiertem Tooling verarbeiten. Kein Nachweis für die Sicherheit aller EAS-Signing-Pfade. |

Die GitHub-Advisories wurden am 2026-10-07 überprüft: Für beide ist dort keine gepatchte Version ausgewiesen. Das ist eine zeitgebundene Beobachtung, kein Versprechen für zukünftige Audit-Ergebnisse.

Das erneute Produktions-Audit nach der Integration von Expo 57.0.27 / React Native 0.86.3 / RNTP 5.12.1 meldet 0 Critical, 23 High und 5 Moderate. Die 23 High-Einträge enthalten 21 transitive Effekte der beiden genannten Wurzeln. Die Plattformmigration hat diese beiden Advisories nicht behoben; ihre exakten Ausnahmen und das Ablaufdatum bleiben unverändert.

## Nachweis und Kontrollen

- Ein aktuelles `npm audit --omit=dev --json` bewertet den tatsächlich installierten Produktions-Abhängigkeitsgraphen. npm zählt zusätzlich transitive Effekte; die Rohanzahl ist nicht mit unabhängigen Sicherheitsfehlern gleichzusetzen.
- `scripts/ci/checkNpmAudit.cjs` ordnet Effekte ihrer Advisory-Wurzel zu. Ein Least-Fixed-Point-Verfahren löst auch Zyklen mit einer erreichbaren Wurzel korrekt; wurzellose Zyklen bleiben blockiert. Negative Tests sichern unbekannte Advisories, Versionen, Ablauf und ungültige Reports ab.
- Security, Quality und Native laufen unabhängig. `Required release checks` akzeptiert ausschließlich drei erfolgreiche Ergebnisse, niemals `skipped`, `cancelled` oder `failure`.
- Die drei normalen CI-Jobs haben nur `contents: read`, keine Signing-Secrets und kein `pull_request_target`. Das reduziert Folgen im normalen Prüfpfad; manuelle EAS-/Release-Workflows bleiben separate privilegierte Abläufe.
- Die aktiven EAS-, Release-, Linking-, Supabase- und Emulator-Workflows geben Secrets nur an benötigte Authentifizierungs-, Build-, Signing- und Statusschritte weiter. Paketinstallation und Diagnosen erhalten keine solchen Secrets. Expo-Setup-Actions exportieren keinen Token in nachfolgende Schritte; installierende Autofix-Unterprozesse entfernen vorhandene Tokens ausdrücklich. Shell-Regressionstests prüfen die tatsächlichen Kindprozess-Umgebungen und erkennen absichtlich wieder eingeführte breite Berechtigungen.
- Ein frischer Produktions-Android-Export mit Hermes und Source Maps prüft `scripts/ci/checkAndroidBundleDependencies.cjs`. `braces`, `micromatch`, `node-forge` und das moderate Tooling-Risiko `sprintf-js` dürfen dort nicht enthalten sein. Fehlende/leere/ungültige Maps und ein eingeschleustes Tool-Paket lassen den Check fehlschlagen.
- Eine Source Map beweist ausschließlich die Abwesenheit dieser Pakete im erzeugten JavaScript-Bundle. Sie beweist weder die Abwesenheit von Build-Time-Risiken noch die Sicherheit nativer Bibliotheken, dynamischer Downloads oder des Signing-Prozesses.

## Auflösung vor Ablauf

1. Gepatchte kompatible Version oder belastbare Tooling-Alternative auf dem jetzt integrierten SDK-57-/RNTP-5-Stand prüfen; weitere Major-Upgrades benötigen eine eigene native Prüfung und sind kein Nachweis für die Behebung dieser Advisories.
2. Lockfile neu erstellen und `npm ci`, aktuellen Audit, Expo-Kompatibilität, Produktions-Export und alle Quality-/Native-Gates ausführen.
3. Beide exakten Ausnahmen nach erfolgreicher Auflösung entfernen und Issue #396 mit der Commit-/CI-Evidenz schließen. Keine automatische Verlängerung.
4. Wenn bis zum Ablauf kein Fix verfügbar ist, explizite Maintainer-Entscheidung über eine neue, begründete Frist einholen. Ohne Entscheidung bleibt der Release blockiert.
