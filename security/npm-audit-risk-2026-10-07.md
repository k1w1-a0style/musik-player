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


## Erneute Bewertung zum Arbeitsplan V3 — 2026-10-11 (F25)

Ausgangsbranch `codex`, Commit `9760a811f3c769cc8a6a0c1fd52bbb9d95474ff9`. Das frische Produktions-Audit unter Node 22.23.3 meldet weiterhin **0 Critical, 23 High, 5 Moderate**. Das verbindliche Policy-Gate besteht mit exakt den zwei vorhandenen Ausnahmen; 21 High-Einträge sind transitive Effekte. Die Frist **21.10.2026** und die zugelassenen Versions-/Advisory-IDs wurden nicht erweitert.

Primärquellen und Registryabgleich vom 11.10.2026:

| Paket | Installiert / veröffentlichter Registry-Stand | Advisory / behobene Version | Entscheidung |
| --- | --- | --- | --- |
| braces | 3.0.3 / 3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), keine | Befristete bestehende Tooling-Ausnahme bleibt sichtbar. |
| node-forge | 1.4.0 / 1.4.0 | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), keine | Befristete bestehende Tooling-Ausnahme bleibt sichtbar. |
| sprintf-js | 1.0.3 / 1.1.3 | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), keine; betroffen bis einschließlich 1.1.3 | Ein Update auf 1.1.3 behebt den Befund nicht. Keine Scheinbehebung durch ein Override. |

Befehle: `npm audit --omit=dev --json`, `node scripts/ci/checkNpmAudit.cjs <audit.json> security/npm-audit-exceptions.json package-lock.json`, `npm view braces version --json`, `npm view node-forge version --json`, `npm view sprintf-js version --json`. Die aktuelle Android-Hermes-Source-Map mit 1.610 Quellen besteht den Bundle-Boundary-Check; die vier ausgeschlossenen Toolingpakete sind dort nicht enthalten. Das ist weiterhin ausschließlich ein JS-Bundle-Nachweis.

Das Audit empfiehlt zum Teil Expo 44.0.6 beziehungsweise React Native 0.87.1 als graphweite Änderung. Solche Vorschläge sind kein kompatibler Patch des aktuellen Expo-57-/RNTP-5-Vertrags und wurden nicht angewandt. **F25 ist neu bewertet, die drei Upstream-Schwachstellen sind nicht behoben.** Vor Ablauf ist ein kompatibler Fix oder eine ausdrückliche neue Maintainerentscheidung erforderlich; keine automatische Verlängerung.

## V5 — eng gebundene lokale Schutzmaßnahmen am 12.10.2026

Die zwei High-Wurzeln wurden auf den genau installierten Tooling-Payloads lokal gehärtet. Dies ist **keine Behauptung eines bereinigten npm-Audits oder einer veröffentlichten Upstream-Reparatur**. Die Registry liefert weiterhin `braces@3.0.3`, `node-forge@1.4.0`, `sprintf-js@1.1.3`; das frische Audit zählt 0 Critical, 23 High und 5 Moderate. F25 / [Issue #396](https://github.com/k1w1-a0style/musik-player/issues/396) bleibt für den kompatiblen Upstream-Ersatz und die Moderate-Wurzel offen. Die vorhandene Frist **21.10.2026** wurde nicht verlängert.

- **Forge:** Der Schutz baut auf [Upstream PR #1159](https://github.com/digitalbazaar/forge/pull/1159), Commit `db05494352dd3c9a5a07c5270333dcc78866cad2`, auf. RSA-PKCS#1-v1.5-DigestInfo wird kanonisch DER-kodiert und mit den dekodierten Bytes verglichen, sowohl mit leerem NULL-Parameter als auch in zulässiger parameterloser Form. Der Schutz liegt in `lib/rsa.js`, `dist/forge.min.js` und `dist/forge.all.min.js`. Ein reiner Elementanzahl-Check aus PR #1152 reicht nicht: NULL mit Nutzdaten sowie nicht minimale DER-Längen würden weiter akzeptiert. Normale SHA-Signaturen und von OpenSSL signierte X.509-Zertifikate bleiben gültig. Die bestehenden strikten Padding- und Trailing-Byte-Grenzen bleiben erhalten; private, ausdrücklich nicht unterstützte Testoptionen erhalten ihren bisherigen Vertrag.
- **braces:** [Upstream PR #88](https://github.com/micromatch/braces/pull/88), Commit `a795ee83ecd011131b2d618fe754ac5a8e124dae`, liefert die Parser-/AST-Tiefengrenze. Der lokale Patch ergänzt ein Budget von 65.536 besuchten AST-Knoten sowie begrenzte, zyklusgeprüfte Elternketten. Eigene ASTs werden vor compile/expand/stringify geprüft. Geteilte azyklische Knoten und Teilbäume mit externem Elternknoten bleiben bei den bereits unterstützten Operationen nutzbar; unvollständige reguläre Muster werden nicht pauschal abgewiesen. Maximal 127 verschachtelte Parser-Blöcke erlauben Blattknoten bei AST-Tiefe 128.
- **Payloadbindung:** `postinstall` führt zuerst den bestehenden RNTP-Patch und anschließend `patchToolingSecurity.cjs` aus. Versionen, vollständige Dateilisten sowie Original-/End-SHA-256 sind festgeschrieben. Jede Datei zählt, einschließlich Maps, Metadaten und möglicher Dateinamen ohne Erweiterung; dadurch können Dateien wie `lib/compile` den geprüften `.js`-Einstieg nicht unbemerkt überschreiben. Symlinks, fehlende Dateien, fremde Dateien und unbekannte Bytes brechen Installation/Gate ab. Bereits exakt gepatchte Installationen bleiben idempotent. Vor dem ersten Schreibschritt werden beide Pakete vollständig geprüft.
- **Auditbindung:** Das Gate prüft die tatsächlich installierten End-Payloads zusätzlich zum Lockfile. Ein `audit.error`, unbekannte Schweregrade/Advisory-Identitäten, widersprüchliche Zähler, fehlende einzelne Locknodes und unerkannte Dependency-Kanten führen zum Fehlschlag. Die 21 bekannten High-Effekt-Einträge sind mit Package, Severity, Kanten, Nodes und Versionen ausdrücklich fixiert; neu hinzugefügte Einträge erben keine Freigabe von einer bekannten Root. Neue/verschobene Root-Advisories, Versionen und die bestehende Ablaufgrenze bleiben blockierend.

**Frische Host-Evidenz:** Der unabhängige Corpus aus Node/OpenSSL-Signaturen und selbst erzeugten DER-Bytes zeigte vor dem Patch 67 fehlschlagende Checks von 128: vier zusätzlich akzeptierte fehlerhafte DigestInfo-Formen pro Hashalgorithmus und Forge-Einstieg sowie ungebundene braces-Rekursion. Nach dem Patch besteht der erweiterte Corpus 142 Checks: fünf SHA-Algorithmen, beide gültigen Parameterformen, fünf fehlerhafte Strukturformen, drei Forge-Einstiege, niedriger öffentlicher RSA-Exponent 3, OpenSSL-Signer/Zertifikate, Parser-/AST-Tiefengrenzen, Knotenbudget, geteilte DAGs und Elternketten. Dieser Befund belegt die geprüften Schutzgrenzen, keine universelle Kryptografieprüfung.

Die Tests prüfen außerdem Idempotenz, Versionswechsel, fehlende Einstiegspunkte, veränderte Bytes, Symlinks und drei Dateinamen ohne Erweiterung. Eine erneute saubere `npm ci --no-audit --no-fund` mit Node 22.23.3 installiert 850 Pakete und führt RNTP- sowie Tooling-Patch aus. Abnahme der integrierten App und ihres endgültigen APK bleibt Aufgabe des gemeinsamen V5-Qualitätsgates.

## 12.10.2026 - SDK-57-Kompatibilitätspatches

Der Online-CI-Check verlangte Expo57.0.28, expo-dev-client57.0.20 und jest-expo57.0.6. Diese drei direkten Patchstände wurden aktualisiert. Der Lockfile-Diff enthält die daraus resultierenden Expo-Patchabhängigkeiten; React Native0.86.3, React19.2.3 und RNTP5.12.1 bleiben gleich. Im kompensierten Auditgraphen wurden ausschließlich die Versionsbindungen von expo57.0.27 auf57.0.28 und @expo/cli57.0.28 auf57.0.29 angepasst, nach unabhängiger Gleichheitsprüfung aller übrigen Kanten, Nodes und Schweregrade. Roh-Audit weiter0critical/23high/5moderate; Forge-/braces-Payloads unverändert verifiziert. Frist21.10.2026 und Issue396 bleiben unverändert.
