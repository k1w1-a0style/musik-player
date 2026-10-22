# Sicherheitsfrist 21.10.2026 – aktueller Befund

**Freigabeblocker offen. Keine Fristverlängerung und keine Policy-Abschwächung.**

Prüfstand: codex/fc29652c6fcb74b54ea7cc1c91360b72116cf81b, fortgesetzter Auftrag vom 22.10.2026. Die Laufzeit meldet 21.10.2026, 22:48 UTC (22.10.2026 in Berlin). Die bisherige CLI verwendet UTC-Kalendertage und besteht deshalb noch vor ihrer UTC-Grenze. Für diesen Auftrag wird daraus ausdrücklich keine Freigabe abgeleitet: die Prüfung mit Stichtag **2026-10-22** lehnt beide Ausnahmen ab. Weder Uhr noch Ablaufdatum wurden geändert.

## Tatsächlicher UTC-Befund der aktuellen Quelle

Am **22.10.2026, 00:14:53 UTC** lehnt die unveränderte CLI die Ausnahmen auch ohne simulierten Stichtag ab. Source `0012899a8e93a66b5b18ebbc28e56edfe808a892`, [CI39698476835](https://github.com/k1w1-a0style/musik-player/actions/runs/39698476835), Securityjob119561587625: verifizierte Kompensationspayloads und exakt gebundener Graph mit 0 kritisch / 23 hoch / 5 moderat; danach ausschließlich `braces: exception expired on 2026-10-21` und `node-forge: exception expired on 2026-10-21`. Die Android-UI-Stufe benötigt ein erfolgreiches Securitygate und bleibt deshalb blockiert. Der native Build und die Qualitätsprüfungen laufen unabhängig; das ist keine Gesamtfreigabe.

Erneuter Registry-/Advisoryabgleich kurz nach dem Tageswechsel: braces weiterhin3.0.3, node-forge weiterhin1.4.0; keine gepatchte Veröffentlichung in beiden offiziellen Advisories. Das vorherige Vor-Mitternacht-Ergebnis oben bleibt als Verlauf erhalten. Aktueller Gesamtstand: [Fortsetzungsbericht](continuation-status-2026-10-22.md).

## Frische Prüfung

- Sauberes npm ci: erfolgreich, 851 Pakete; vier RNTP- und acht Tooling-Payloads geprüft/gepatcht. Package-/Lockfile unverändert.
- Sicherheitskorpus: 142/142 Fälle erfolgreich. Gezielte Jest-Suiten für Patchintegrität, Audit-Policy und Android-Bundle-Grenze: 47/47 Tests erfolgreich, kein Skip.
- Neues npm audit --omit=dev --json: 0 kritisch, 23 hoch, 5 moderat; genau zwei Advisory-Wurzeln und 21 gebundene transitive Effekte, keine Graph-/Versions-/Advisory-Drift.
- Unveränderte Policy mit evaluateAudit(..., today: '2026-10-22'): exakt `braces: exception expired on 2026-10-21` und `node-forge: exception expired on 2026-10-21`.
- image-size fehlt weiterhin im Lockfile. Lokale Schutzpatches bleiben hashgebunden und aktiv. Das beseitigt den offenen Advisory-/Friststatus nicht.

## Upstream-Abgleich

| Abhängigkeit | Neueste npm-Version | Abhilfe verfügbar? |
|---|---|---|
| braces | 3.0.3 | Offizielles Advisory: keine gepatchte Veröffentlichung; Issue70 offen. |
| node-forge | 1.4.0 | Offizielles Advisory: keine gepatchte Veröffentlichung; PR1152 offen, nicht gemergt. |
| micromatch | 4.0.8 | Hängt weiterhin von braces ^3.0.3 ab. |
| @expo/code-signing-certificates | 0.0.7 | Hängt weiterhin von node-forge ^1.4.0 ab. |

Die vorhandenen lokalen Backports decken bereits Braces-Tiefen-/Zyklen-/DAG-Grenzen und kanonisches Forge-DER einschließlich beider Bundles ab. Ein Versionsetikett, eine neue Ausnahme oder ein ungeprüfter Toolchain-Majorwechsel wäre kein nachgewiesener dauerhafter Fix. Keine dieser Maßnahmen wurde vorgenommen. Issue396 bleibt offen.

## Konsequenz und nächster belegbarer Schritt

Emulator-/App-Funktionsnachweise dürfen separat weiterlaufen, ohne sie als Security- oder Gesamtfreigabe darzustellen. Eine neue APK mit identischem Produktcode wird dafür nicht gebaut. Die reguläre integrierte CI wird einmal am gesicherten Fortsetzungsstand ausgeführt; ein UTC-bedingt noch grünes Security-Gate ersetzt die explizite abgelaufene Stichtagsprüfung nicht.

Die Blockade endet erst mit einer tatsächlich geprüften kompatiblen Abhilfe bzw. einem separaten expliziten Owner-Entscheid. Für diesen Auftrag ist keine Fristverlängerung autorisiert; die Deadline bleibt unverändert. Ohne Auflösung keine finale Projekt-/APK-Freigabe.

Primärquellen (frisch gelesen):
- https://registry.npmjs.org/braces/latest
- https://registry.npmjs.org/node-forge/latest
- https://registry.npmjs.org/micromatch/latest
- https://registry.npmjs.org/@expo%2fcode-signing-certificates/latest
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-86w9-cpqp-85rv
- https://github.com/micromatch/braces/issues/70
- https://github.com/digitalbazaar/forge/pull/1152
- https://github.com/k1w1-a0style/musik-player/issues/396
