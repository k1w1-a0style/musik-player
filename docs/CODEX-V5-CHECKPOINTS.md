# V5 – externe Arbeitszwischenstände

Stand: 12. Oktober 2026. Basis codex: 74af98a1d33a14e51aaa02598bcf9b5be0e48e25.

Diese Gitobjekte sind ausschließlich Arbeitszwischenstände. Sie wurden nicht als geprüfte App oder finale V5-Abnahme veröffentlicht. Nach lokalen Rücksetzungen muss ihr Inhalt aus GitHub rekonstruiert und vor Integration überprüft werden. main bleibt unverändert.

| Bereich | Commit | Tree | Zustand |
| --- | --- | --- | --- |
| Scan: erste Hängerregressionen | 446228be451a218528aeb950d3e62dd73d72cf9b | efbe1f66376d2777ec65875e9d0c9ed21823bd32 | WIP, rekursiver Testhelper im Nachfolger korrigiert |
| Scan: optionale Wartung aus Speicher-ACK | 7eb80a44033c93b14c145db8db5d2cd3446daf50 | 9e9a3836bb5abab43a9baf93f3c17bcfef08b19d | 3 Regressionen rot → grün; Race/Epoch/Gates offen |
| Cleaner: Typen und Quellenauswahl | d62241179138499f2154410a75ff5f8edc40deba | 8b237d977b68538f45af88888fe4da599b7b9d45 | 3 Auswahltests grün; noch kein vollständiger Cleaner |
| Oberfläche: Wechselhinweise/Viewport | 27a835dc1125dc2a7456b33c5bd1cc2104f5695c | 1c16726ab39a157ccd7f9f7cb562ac3e8910439c | WIP, Tests und Einbindung offen |

## Noch offene integrierte Arbeit

Tag-Cleaner mit echter Vorschau, bestätigtem Speichern, Playback-Schutz und SAF-Readback; Auswahl und Einstiegspunkte; persistente Akzente und Cover-Palette; Scan-Wartungsrennen; F25; End-to-End-Abnahme derselben finalen APK; aktualisierte Full-Scan- und Ideen-Dokumente.

P1-APK des Quellstands 8a47be64e6e813b606c5516e285d00922e3a13a6 (SHA256 b075699a70c5d17b7f77b00d880640d0960aa8bf701236c02de450310243c0ba) ist **keine finale V5-APK**. Retest 38218345873 scheiterte beim erneuten Erreichen eines importierten langen Titels. Die sichtbaren UI-Artefakte werden untersucht; ein App-Fehler wird daraus noch nicht behauptet.
