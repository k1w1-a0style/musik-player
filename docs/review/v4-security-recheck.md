# F01 – Sicherheitsprüfung vom 16.10.2026

**Aktuelle Kompensation bestätigt; dauerhafte Fristlösung extern blockiert.** Kein Package-/Lockfile-/Policy-Update und keine Verlängerung vorgenommen.

Die frisch abgefragte npm-Registry liefert weiterhin braces 3.0.3 und node-forge 1.4.0 als neueste Versionen. Beide offiziellen GitHub-Advisories führen keine gepatchte veröffentlichte Version auf:

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-86w9-cpqp-85rv

Eine Umstellung auf dieselbe verwundbare Version oder eine bloße Änderung der Versionsnummer wäre keine Abhilfe. Ein ungeprüftes Expo-/RN-Major-Upgrade wird nicht als Sicherheitsfix ausgegeben. Die vorhandenen lokalen Backports begrenzen Braces-Parser/AST/Elternketten/zyklische und DAG-Eingaben sowie Forge-DigestInfo/DER einschließlich beider Distributionsbundles. Ihre exakten Payload- und Upstream-Hashes stehen im zugehörigen JSON.

## Frische Ausführung

- `npm ci`: erfolgreich; 851 Pakete, vier RNTP- und acht Tooling-Payloads geprüft/gepatcht.
- `node scripts/patches/tooling-security/regressionCases.cjs`: 142/142 unabhängige Positiv-/Negativfälle erfolgreich.
- Gezieltes Jest: patchToolingSecurity, checkNpmAudit, checkAndroidBundleDependencies – drei Suiten, 47 Tests, kein Skip. Enthalten sind falsche Payloads, fehlende Bundles, Require-Shadowing, Symlinks, Versionsdrift, abgelaufene/ungültige Ausnahmen und Bundle-Grenzverletzungen.
- Frisches `npm audit --omit=dev --json` und unverändertes `checkNpmAudit.cjs`: 0 kritisch, 23 hoch, 5 moderat; zwei exakt gebundene kompensierte Wurzeln und 21 transitive Effekte. Policy erfolgreich, keine neue Ausnahme.
- Frischer Android-Hermes-Export samt Source Map und Bundle-Grenzprüfung: 1 Map / 1.682 Quellen, Tooling-Pakete ausgeschlossen. Dies ist kein APK-Build.

## Entscheidung und Ablauf

Die beiden Ausnahmen bleiben unverändert bis **21.10.2026** gültig. Die Prüfung abgelaufener Ausnahmen bleibt aktiv. Ohne echte kompatible Upstream-Abhilfe oder ausdrückliche neue Nutzerfreigabe darf das Audit-Gate nach Ablauf nicht als erfüllt gelten. Die vorhandenen Backports beseitigen nicht den offenen npm-Advisory-Status.

Eine spätere eng begrenzte Verlängerung wäre eine eigene Entscheidung mit neuem Datum, erneuter Reachability-/Payload-/Advisory-Prüfung und unverändertem Fail-closed-Vertrag; sie ist hier **nicht autorisiert und nicht umgesetzt**. Auch die reale Geräte-/Herstellerfreigabe und ein öffentlicher Produktionsrelease sind dadurch nicht erteilt.
