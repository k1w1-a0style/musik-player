# K1W1 – Fortsetzung und Abnahmestand vom 22.10.2026

**Nicht vollständig freigegeben.** Der aktuelle Code ist gesichert; die abgelaufenen Sicherheitsausnahmen blockieren die Android-Abnahme. Der native Cover-Crash wurde eingegrenzt und eine gezielte Korrektur implementiert. Ihre Bestätigung auf Android steht aus.

Arbeitsbranch: `codex`. Aktuelle Produktquelle: `0012899a8e93a66b5b18ebbc28e56edfe808a892`.
[Source-CI 39698476835](https://github.com/k1w1-a0style/musik-player/actions/runs/39698476835).
`main` und ursprüngliche Musikdateien wurden nicht verändert. Abschließender Remote-Abgleich: `main` weiterhin `b62b91b59c7400fd310a5db8fcbf9fc6444ff393`; kein anderer aktiver Lauf unter den aktuellen codex-Runs. Nach Quelle0012899 wurden ausschließlich Nachweisdokumente ergänzt.

## Übernahme und erledigte Arbeit

Übernommen wurde `227fecff28d5fd92452d406add4b6802f40abca7`. Zum Ist-Abgleich liefen keine codex-CI und keine anderen lokalen Projektprozesse. V5-ZIP, Checkpoints, konsolidierter Deep-Scan vom 17.10. und aktuelle Original-Logs wurden abgeglichen. Bereits implementierte Cleaner-, Queue-, Palette-, Scan- und Schriftgrößenfunktionen wurden erhalten.

| Arbeitspaket | Änderung | Nachweis / Grenze |
|---|---|---|
| Emulator-Laufzeit | Zentrale ldd-Prüfung erhält die SDK-eigenen Core-, Qt- und Grafikbibliothekspfade. Alle drei Aufrufer angepasst; Assertions bleiben streng. | Echter Compiler-/Linker-Negativtest und erfolgreiche Bereitstellung im GitHub-Runner. |
| Aktueller SDK-Blocker | Expo exakt 57.0.31 mit erforderlichen Unterabhängigkeiten. In der Audit-Effektbindung nur Expo-/CLI-Version nachgezogen. | Aktuelle Expo-Kompatibilitätsprüfung erfolgreich; keine Frist- oder Advisory-Änderung. |
| Veraltete Start-Audits | Zusätzliche Ablaufprüfung am Ende der regulären Freigabe und beider Retestwege. | Mitternachtsregression und fehlerhafte Policy geprüft. Alte grüne Audits können keine abgelaufene Ausnahme freigeben. |
| Cleaner-Schaltflächen | Prüftreiber akzeptiert keine geclippten Cleaner-Aktionen am vertikalen Listenrand; volle Breite bleibt zulässig. | Aufgezeichnetes XML, zwei RED→GREEN-Fälle und zusätzlicher 104-Pixel-Grenzfall. Mindestfläche nicht gelockert. |
| Diagnose | Ursprüngliche Fehler bleiben trotz fehlgeschlagener finaler Aufnahmen erhalten. Fehler nach zuvor erfolgreicher Abnahme werden weiterhin weitergeworfen. Host-RAM und Emulator-PID-Status werden erfasst. | Fehler-/Erfolgs- und Prozessverlustfälle geprüft. Keine zusätzlichen Transport-Retrys. |
| Nativer App-Crash | Fallback-Cover-Parent bleibt mit `collapsable={false}` nativ, wenn Pause seine Opacity-/Transform-Eigenschaften entfernt. | Fehlende und defekte Cover sowie Image-/Parentidentität und Playing-/Pause-Stile geprüft. Android-Bestätigung fehlt. |
| Crash-Erkennung | Nach jedem Format-Player-Back sind Runtime-Log und stabiles Bibliotheks-ACK erforderlich. | Original-Fabric-Crash als Fixture; ein Crash kann kein erfolgreiches Library-ACK erzeugen. |

Der gemeinsame CoverCard-Pfad deckt statische und Queue-Covers ab. New Architecture, Native-Stack-Animationen, Listenvirtualisierung, SAF-Writer, Recovery-Journal und Wiedergabebackend wurden dafür nicht deaktiviert oder umgebaut.

## Aktuelle Prüfung am exakten Produktstand

| Prüfung | Ergebnis |
|---|---|
| TypeScript, strenger ESLint, Expo-Kompatibilität, NUL, Complexity, Releasekonfiguration und Manifest | erfolgreich |
| Vollständiges Jest | 435 Suiten / 4.197 Tests erfolgreich |
| Coverage | 92,94 % Statements / 85,32 % Branches / 94,10 % Functions / 96,03 % Lines |
| Python-Harness und Diagnose | 182 Tests erfolgreich |
| Android-Hermes-Bundle | 1 Map / 1.688 Quellen; Tooling-Pakete ausgeschlossen |
| Security-Audit | **fehlgeschlagen:** ausschließlich beide Ausnahmen am 21.10.2026 abgelaufen; 0 kritisch / 23 hoch / 5 moderat, 2 Wurzeln / 21 Effekte |
| Nativer Build / JUnit / APK | erfolgreich: 19m14s Build, 24 Suiten / 178 Tests, 0 Fehler / Failures / Skips; exakte APK geprüft |
| Vollständige aktuelle Android-UI-Abnahme | Job119568184548 wegen Security-Gate übersprungen; keine Installation / UI-Abnahme dieser Bytes |
| Gesamt-CI / Required release checks | fehlgeschlagen wegen Security; keine Gesamtfreigabe |

Die lokale Audit-CLI lehnt seit dem tatsächlichen UTC-Tageswechsel ebenfalls beide Ausnahmen ab. Hashgebundene Tooling-Patches bleiben verifiziert. Frische npm-Abfragen liefern weiterhin braces 3.0.3 und node-forge 1.4.0; die offiziellen Advisories nennen keine gepatchte Veröffentlichung. Die Frist wurde nicht verlängert. Details: [security-expiry-2026-10-22.md](security-expiry-2026-10-22.md).

## Tatsächliche Gerätebefunde

- Der neue SDK-Build `35b3ae2` hatte erfolgreiche Qualität und 178 native Tests. Seine Font2-Stufe speicherte 10 von 12 Fällen, bevor UI-RPC/ADB ausfiel. Das wurde nicht als vollständige Abnahme gezählt.
- Der frische Vollret [39696123417](https://github.com/k1w1-a0style/musik-player/actions/runs/39696123417) spielte MP3, M4A und FLAC nativ ab. Nach Pause/Zurück beim FLAC endete die App mit einem echten Fabric-Absturz. Emulator und Host waren weiter verfügbar; es war diesmal kein Transportfehler.
- Das Original-Log zeigt ein ReactImageView, das von ViewGroup 3072 nach 3074 verschoben werden sollte, während die alte Zuordnung noch bestand. Das passt zur beim Pausieren flattenbaren Fallback-Cover-Hülle. Die Korrektur hält diese Hülle explizit nativ; sie ist noch nicht auf Android bestätigt.
- Die APK `35b3ae2` / SHA `c627760a5103bcc05a582b41a9e4b468e7008ca57320260d7ffb75e2290995bb` ist **nicht freigegeben und supersediert**. Ihre Signaturprüfung ist kein Beleg für Fehlerfreiheit. [Maschinenlesbarer historischer Befund](apk-35b3ae2-provenance.json).

Aufgezeichnete Originalartefakte wurden jeweils auf Größe, SHA-256 und vollständige ZIP-CRC geprüft. Keine alten V5-/APK-Belege wurden der neuen Produktquelle zugerechnet.

## APK-Herkunft

**Signierter Prüfkandidat, nicht freigegeben.** Nativejob119561587790 und seine offiziellen APK-/Signaturgates sind erfolgreich. APK und JUnit wurden unabhängig aus den Originalartefakten geladen und auf Archivgröße, SHA-256 und volle ZIP-CRC geprüft. Die Zuordnung zu Quelle0012899 wurde aus dem CI-Run und `source-commit.txt` bestätigt. Die APK-Signatur bindet die APK-Bytes; die Zuordnung zum Git-Commit stammt aus dem CI-Build und den Artefaktmetadaten.

| Merkmal | Nachweis |
|---|---|
| APK | 100.860.957 Bytes; Paket `com.k1w1a0style.musikplayer`, Version1.0.0 / Code1 |
| APK-SHA-256 | `d0cecca14954efcaed7aa0e3653d0fa4a691aa38391e9795f942d05c110785a5` |
| Signatur | APKv2, ein Signer, RSA2048 / PKCS1-SHA256; offizielles apksigner und unabhängige RSA-/Inhaltsdigestprüfung erfolgreich |
| Zertifikat-SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Android | minSdk24, targetSdk36; arm64-v8a / armeabi-v7a / x86 / x86_64 |
| Originalartefakt | [12392467026](https://github.com/k1w1-a0style/musik-player/actions/runs/39698476835/artifacts/12392467026), 48.116.946 Bytes |
| Archiv-SHA-256 | `37266fb184f7e880ac69482841e582a4a14c6b2622ce80a799982dc9f062f689` |
| Native JUnit | Artefakt12391878875, 79.508 Bytes, SHA `e0e0391aa53e139f0951b49df3d47a8dd372f96ef11d6090b90e8fb7cd3cf93e`; alle 24 XML-Suiten unabhängig summiert: 178 Tests, 0 Fehler / Failures / Skips |

[Maschinenlesbare Herkunft und Grenzen](apk-0012899-provenance.json). Die aktuelle UI-Stufe wurde wegen des roten Source-Securitygates nicht ausgeführt. Installation, vollständige UI-Matrix und Bestätigung des nativen Crash-Fixes sind daher für genau diese APK **nicht nachgewiesen**. Der Kandidat ersetzt keine abgenommene Release-APK.

## Verbleibende Freigabegrenzen

1. **SEC-01 / Issue396:** kompatible, tatsächlich geprüfte Abhilfe für die zwei Advisory-Wurzeln erforderlich. Bestehende Kompensationen ersetzen die abgelaufene Entscheidung nicht. Keine Version umetikettiert, kein Fund ausgeblendet und keine Policy umgangen.
2. **Native Crash-/UI-Abnahme:** Korrektur auf der exakten neuen APK mit Hardware-Back/Pause, allen Funktionen und 36 Darstellungsvarianten prüfen, sobald die Source-Sicherheitsgates erfüllt sind. Bis dahin keine Aussage „Crash auf Android behoben“ und keine endgültig geprüfte APK.
3. **Physische Geräte:** Samsung/Huawei, SD-/Cloud-SAF, Bluetooth/Headset, gesprochenes TalkBack und reale 10/25/50-MiB-Provider-Messungen bleiben ohne entsprechende Hardware offen. [Konkrete externe Abnahme](v4-real-device-gate.md).

## Wiederaufnahme ohne Doppelarbeit

Aktuelle Codequelle und CI oben verwenden; historische 35b3ae2-APK wegen ihres bestätigten Absturzes nicht erneut freigeben. Erst Security-Blocker mit einer echten kompatiblen Lösung schließen. Danach vollständige Source-CI und exakt zugeordnete APK-/UI-Abnahme, mit allen vorhandenen Assertions. Keine unbegrenzten Infrastruktur-Retrys und keine erneute Implementierung erledigter V5-Funktionen.

Weitere Zuordnung und Commits: [V5-Checkpoints](../CODEX-V5-CHECKPOINTS.md) und [konsolidierte Review-Ergebnisse](consolidated-fix-results-2026-10-17.md).

Primärquelle zur Native-Stack-/Fabric-Klasse und empfohlenen stabilen View-Hülle:
https://github.com/software-mansion/react-native-screens/issues/4677
