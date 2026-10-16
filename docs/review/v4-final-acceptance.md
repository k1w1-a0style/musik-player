# V4-Nacharbeiten – technischer APK-Abschluss und offene Freigabebedingungen

Stand 16.10.2026. **Neue technische Emulator-/Sichtabnahme bestanden; Gesamtauftrag extern blockiert.** Kein Main-Merge und kein öffentlicher Produktionsrelease. Alle zwölf Findings und neun Phasen: [Status](v4-nacharbeiten-status.md). [Vollständiger aktualisierter Bericht](v4-ui-panel-report.md).

## Aktuelle exakt geprüfte APK

Produktquelle `f2c46d3742e80655ccf06bc1900811434c4a4686`; SHA256 `609d6080eb296dcf9e13791c7a67955ffbdbab6c0767ab568faa2ed001fafe50`; 100.832.661 Bytes; APK-Artefakt 12044008297 aus [Source-CI 38895123158](https://github.com/k1w1-a0style/musik-player/actions/runs/38895123158). Archiv, Source und APK-Bytes unabhängig geprüft. Verpflichtendes V2-Signatur-Gate erfolgreich, bekannte Preview-Testsignatur; kein Store-Release.

## Neue und eigenständige Abnahme

- Alle fünf CI-Jobs erfolgreich: 429 Jest-Suiten / 4.165 Tests, 161 Python-Tests, 96 % Zeilenabdeckung, 178 native Tests ohne Fehler/Skips, Sicherheits- und Required-release-Gates.
- Android-Job 116959315614: zuerst zwölf gezielte 200-%-Fälle, danach vollständiger Funktionslauf und 36/36 frische Matrixfälle. `release-interaction/result.json`: `status: passed`. Keine Diagnosefehler.
- Originalartefakt 12046677232: 71.481.381 Bytes, SHA256 `0d526d33354f945b3b586782fc9c03043d63a1ef799144793b53371f973738b0`. Digest/CRC, Source/Harness und exakter neuer APK-Hash unabhängig gebunden; 144 Matrix-PNG-/XML-Paare lesbar und zugeordnet.
- Neuer Hintergrundbefund behoben: äußere Margin durch eingefärbte Innenreserve ersetzt, Safe Area einmal konsumiert. Alle 48 Panel-Geometrie-/Pixelprüfungen erfolgreich: 20 dp Abstand, durchgängiger Hintergrund; maximaler geprüfter RGB-Kanalsprung 1. Alle zwölf 200-%-Library-Bilder und weitere Größenübersichten kritisch gesichtet; Dark/Light zusätzlich als Original-PNG. Kein schwarzer Balken an der unteren Listenfläche.
- Vollständige eigene neue Funktionsnachweise einschließlich nativer Wiedergabe, SAF, Queue/Playlist, Resume, Backup/Restore, Farben, Cleaner und SoundCloud-Info. Keine Benutzer-Musik verändert, keine Assertions abgeschwächt.

Maschinenlesbar: [APK-Integrität](evidence/v4-ui-panel-apk-f2c46d37.json), [Abnahme](evidence/v4-ui-panel-acceptance-f2c46d37.json). [Befund und Regression](v4-library-bottom-background.md).

## Historische Nachweise bleiben erhalten

Die vorherige ddcc7ec2-APK mit SHA256 `2e11157f92a4b09ce39801375ab8f08da42ed3a24a21a7e5dde1b01606afbe2a` und ihre 25 + 1 + 10 Fälle aus 38844390898 / 38867090788 / 38867966020 sind im unveränderten [historischen Beleg](evidence/v4-final-apk-acceptance.json) erhalten. Der später bestätigte dunkle Streifen war durch deren damalige Assertions nicht abgedeckt. Diese Fälle wurden nicht als Freigabe der neuen APK verwendet. Der neue Run testet alle 36 Kombinationen selbst. Original-V5-Freigabe c47b27f6 und dauerhafte V5-Originaldateien bleiben erhalten.

## Verbindlich offen

- **F01:** echte dauerhafte Abhilfe oder ausdrücklich neu begründete befristete Entscheidung vor Ablauf **21.10.2026**. Keine Verlängerung vorgenommen. npm-Audit bleibt 0 kritisch / 23 hoch / 5 moderat mit exakt kompensierten Wurzeln; keine Aussage „schwachstellenfrei“. Issue #396 bleibt offen.
- **F06:** physische Samsung-/Huawei-Geräte, reale SAF-/Cloud-/SD-Provider, Headset/Bluetooth und gesprochenes TalkBack. [Prüfprotokoll](v4-real-device-gate.md), Issues #234/#236 offen.
- **F07:** tatsächlicher Provider-/Gerätebenchmark. Host-Basis ersetzt ihn nicht.
- **F04/Main/Produktion:** keine Autorisierung; formale Head-/Review-/Gerätebedingungen separat. `main` bleibt `b62b91b59c7400fd310a5db8fcbf9fc6444ff393`.

Original-V5-APK c47b27f6 und ihre ursprüngliche Freigabe/Nachweise bleiben unverändert in der dauerhaften privaten Ablage erhalten, unabhängig vom Actions-Ablauf am 14.11.2026. Die V4-APK und ihre Nachweise erhalten eigene Namen und eigene Hashes. Die temporäre Probe-Ausführungsdatei ist entfernt; spätere Manifest-Retests laufen standardmäßig vollständig. Das aktuelle APK-Manifest zeigt auf f2c46d37; nur Dokumentation/Manifest werden nachträglich mit [skip ci] gesichert.
