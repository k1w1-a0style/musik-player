# V4-Nacharbeiten – technischer APK-Abschluss und offene Freigabebedingungen

Stand 16.10.2026. **Technische Emulator-Abnahme bestanden, Gesamtauftrag extern blockiert.** Kein Main-Merge und kein öffentlicher Produktionsrelease. Alle zwölf Findings und alle neun Phasen sind in [v4-nacharbeiten-status.md](v4-nacharbeiten-status.md) zugeordnet.

## Exakte APK

Source `ddcc7ec2fcb03f68720927c23b06996d59b24dd1`; APK-SHA256 `2e11157f92a4b09ce39801375ab8f08da42ed3a24a21a7e5dde1b01606afbe2a`; 100.832.529 Bytes; Quellartefakt 12020982828. Archiv, eingebettete Source, APK-SHA, V2-Signatur und Inhaltsdigest geprüft. Preview-Testsignatur, kein Store-Release. Während der Fortsetzung wurden keine produktiven App-Änderungen und keine neue APK erzeugt.

## Unabhängig verifizierte Nachweise

| Lauf | Harness | Ergebnis / Umfang | Originalartefakt |
|---|---|---|---|
| [38844390898](https://github.com/k1w1-a0style/musik-player/actions/runs/38844390898) | 6271b300 | Gesamtlauf bleibt failure; vollständiger Funktionsprefix und 25 Matrixfälle vor einzigem Scrollfehler erfolgreich | 12024085233 |
| [38867090788](https://github.com/k1w1-a0style/musik-player/actions/runs/38867090788) | 72a19aec | success; ausschließlich 200 % / dark / graphite / compact | 12032061690 |
| [38867966020](https://github.com/k1w1-a0style/musik-player/actions/runs/38867966020) | ccd17d2a | success; ausschließlich zehn weitere 200-%-Fälle | 12032825230 |

25 + 1 + 10 = **36 exakt verschiedene Matrixfälle**, keine Doppelzählung. Vollständige Originalarchive mit Run-/Harness-/Source-/APK-Bindung, SHA und CRC unabhängig geprüft. 108 Settings-/Library-/Player-Bilder und XML-Zeugen sowie tatsächliche native FLAC-ACKs vollständig geprüft. Alle zwölf 200-%-Library-Screenshots und ergänzend Settings/Player kritisch gesichtet; keine abgeschnittene geprüfte Infoaktion, keine Überlappungen der geprüften Header-/Section-Aktionen. Vier SoundCloud-Schriftgrößen mit vollständig sichtbarer Infoaktion und echter TrackInfo-Navigation belegt. Kein neuer bestätigter Produktblocker.

Source-Gates: 429 Jest-Suiten / 4.160 Tests, 96 % Zeilenabdeckung; 178 native Tests, 0 Fehler/Skips; Security-Policy erfolgreich mit unveränderten Ausnahmen. Reguläre [CI 38844315073](https://github.com/k1w1-a0style/musik-player/actions/runs/38844315073) am Commit `26644d3a3d2396d8de323473fcf378670df6548c` tatsächlich grün. 159 aktuelle Treiber-/Provenienztests lokal und im Restlauf grün. Kein späterer Head wird als durch eine fremde Gesamt-CI geprüft ausgegeben.

Maschinenlesbare Zusammenfassung: [v4-final-apk-acceptance.json](evidence/v4-final-apk-acceptance.json). Root Cause und rote/grüne Regression: [v4-song-info-scroll.md](v4-song-info-scroll.md).

## Verbindlich offen

- **F01:** echte dauerhafte Abhilfe oder ausdrücklich neu begründete befristete Entscheidung vor Ablauf **21.10.2026**. Keine Verlängerung vorgenommen. npm-Audit bleibt 0 kritisch / 23 hoch / 5 moderat mit exakt kompensierten Wurzeln; keine Aussage „schwachstellenfrei“. Issue #396 bleibt offen.
- **F06:** physische Samsung-/Huawei-Geräte, reale SAF-/Cloud-/SD-Provider, Headset/Bluetooth und gesprochenes TalkBack. [Prüfprotokoll](v4-real-device-gate.md), Issues #234/#236 offen.
- **F07:** tatsächlicher Provider-/Gerätebenchmark. Host-Basis ersetzt ihn nicht.
- **F04/Main/Produktion:** keine Autorisierung; formale Head-/Review-/Gerätebedingungen separat. `main` bleibt `b62b91b59c7400fd310a5db8fcbf9fc6444ff393`.

Original-V5-APK c47b27f6 und ihre ursprüngliche Freigabe/Nachweise bleiben unverändert in der dauerhaften privaten Ablage erhalten, unabhängig vom Actions-Ablauf am 14.11.2026. Die V4-APK und ihre Nachweise erhalten eigene Namen und eigene Hashes. Die temporäre Probe-Ausführungsdatei wird nach Abschluss entfernt, damit spätere Manifest-Retests wieder standardmäßig vollständig laufen.
