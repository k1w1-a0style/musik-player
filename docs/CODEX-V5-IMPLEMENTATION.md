# Musikplayer – V5-Abnahme, 14.10.2026

**Status: neue APK gebaut und quellseitig geprüft; abschließende Android-UI-Abnahme läuft. Noch keine APK-Freigabe.**

Das bestehende V4-/V5-Projekt wird fortgesetzt. Der Settings-Scrollfehler war ein Treiberfehler: Statt einer festen Zahl von Aufwärtsbewegungen entscheidet der Treiber anhand tatsächlich sichtbarer, app-eigener Settings-IDs über die Richtung. Die ursprünglichen 26 Varianten wurden mit genau zehn weiteren Varianten der identischen Referenz-APK ergänzt. Die vollständige 36er-Referenz ist gesichert. Die anschließende manuelle Sichtprüfung fand einen zusätzlichen echten Appfehler: Der Header-Menübutton war bei 200-%-Schrift und 320 dp auf 12 Pixel abgeschnitten. Flexible Marken-/Textbreite und feste 48-dp-Aktionsflächen beheben die Ursache, ohne Schriftvergrößerung zu deaktivieren.

Diese produktive Änderung erforderte eine neue APK. Die alten 26+10 Fälle werden ausschließlich als Referenz archiviert und nicht als Nachweis für neue APK-Bytes ausgegeben. Die neue APK erhält eine eigene vollständige Abnahme mit striktem Header-Preflight bei 100/200 % und Header-Gates in jeder Variante.

## Exakt zugeordnete neue APK

| Eigenschaft | Nachweis |
|---|---|
| App-/Buildquelle | `30d5b9e1e7df11cb86e30545b3789a8fd29fc995` |
| Source-CI | [38616633219, Versuch 2](https://github.com/k1w1-a0style/musik-player/actions/runs/38616633219/attempts/2) |
| APK-Artefakt | [11921651317](https://github.com/k1w1-a0style/musik-player/actions/runs/38616633219/artifacts/11921651317) |
| APK-Größe | 100.825.509 Bytes |
| APK SHA-256 | `f3b7d6a778aec4c90585d0e2a8a1ae3411f8703a4d8a93be11acaec5ad8e888c` |
| Archiv-Größe / SHA-256 | 48.101.151 Bytes / `0c4a83ee3eacd6dfc6a89d6843ebfb6fa0cb04493b9c902bed1aeef88217b3df` |
| Package / Version | `com.k1w1a0style.musikplayer` / 1.0.0, Code 1 |
| Plattformen | minSDK 24, targetSDK 36; arm64-v8a, armeabi-v7a, x86, x86_64 |
| Signatur | APK-v2 geprüft; öffentliches Preview-Testzertifikat `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |

Die APK ist eine geprüfte Preview-Datei mit bestehender Testsignatur; eine private Store-/Produktionssignierung wird nicht behauptet.

## Erfolgreiche Quellprüfungen

Die drei unabhängigen Source-Gates gehören exakt zur APK-Quelle. Ihr Erfolg wurde vor dem Retest per GitHub-API kontrolliert; Appdateien müssen bytegleich zum APK-Commit sein und jeder APK-Digest muss stimmen.

- 427 Jest-Suiten / 4.133 Tests, 121 Python-Regressionen.
- Coverage: 92,92 % Statements, 85,31 % Branches, 94,03 % Functions, 95,98 % Lines.
- TypeScript, strenger ESLint, Expo-Kompatibilität, NUL-, Komplexitäts-, Hermes-/Bundle- und Manifestgates erfolgreich.
- Android-Release-Build erfolgreich; 168 SystemAudio- und 10 RNTP-Tests, zusammen 178, ohne Fehler.
- Produktionsaudit: 0 kritisch, 23 hoch, 5 moderat. Die strikte Policy bestätigt zwei bestehende kompensierte Advisory-Wurzeln und 21 transitive Effekte aus [Issue #396](https://github.com/k1w1-a0style/musik-player/issues/396), befristet bis 21.10.2026. Keine neue oder verlängerte Ausnahme; kein behaupteter Null-Befund.
- SDK 57.0.29 und seine minimale Patch-Abhängigkeiten sind exakt gelockt; ReactNative 0.86.3 / RNTP 5.12.1 bleiben erhalten. Die zwei Expo-/CLI-Parentversionen der bestehenden Audit-Effektbindungen wurden nach unveränderten Advisory-/Pfad-/Payload-Prüfungen aktualisiert.

## Android-Abnahme dieser APK

[Retest 38622542676](https://github.com/k1w1-a0style/musik-player/actions/runs/38622542676), Harness `aa68e02d9c559e408d24e3554d4f9085108e99c7`, führt die vollständige öffentliche Funktions- und UI-Prüfung aus. Lauf noch nicht abgeschlossen.

| Paket | Abnahmebedingungen |
|---|---|
| Scan und Sammlung | MediaStore-/SAF-Import, sichtbare Titel, native Queue; optionale Waveform-Cancellation mit terminalen ACKs; vorhandene Race-/Epoch-/Persistenz-Regressionsprüfungen |
| Formate, Wiedergabe, Queue | MP3/M4A/FLAC/SAF mit tatsächlichem nativen Positionsfortschritt, Queue 2→5, Drag, Cover-Geste, Hintergrundwiedergabe |
| Resume | Standard Aus, Ein/Aus nach echtem Prozessneustart; Positionsbeleg an nativer pausierter Session und ±3-s-Guard |
| Backup/Restore | Öffentlicher SAF-Export, unabhängige Dateilesung, read-only Inspection, Preview und additive Wiederherstellung; Original, Reihenfolge und Favorit nach Kaltstart |
| Farben und Darstellung | 12 Optionen je App-/Player-/Waveform-Präferenz, drei unterschiedliche persistierte Werte, sofortige Änderung und beide Playerlayouts |
| Tag-Cleaner | Generierte SAF-MP3; Vorschau und Display-only originalbytegleich, persistente/idempotente Anzeige, physischer Write mit unabhängig erhaltenem Audio/APIC/TPUB/WXXX/ReplayGain/XKIW/.lrc |
| UI-Matrix | 320 dp; Schrift 100/130/200 % × hell/dunkel × graphite/minimal/neon-cover × Standard/Kompakt = 36; vollständige 48-dp-Touchflächen, keine Überlappungen; PNG/XML für Settings/Library/Player |
| Abschluss | Keine app-eigene FATAL-/ANR-/ErrorBoundary-Ausnahme; unabhängige Ergebnis-/Byteprüfung und manuelle Sichtkontrolle vor Freigabe |

Der vorherige Source-UI-Job wurde bereits vor Appstart durch ein ungültiges Emulator-ZIP unterbrochen; deshalb ist die gesamte Source-CI nicht grün. Der separate Retest baut nichts neu. Der offizielle Emulator-Download wurde unabhängig nach deklarierter Größe, Prüfsumme und ZIP-CRC geprüft; die konkret fehlende Runner-Bibliothek libpulse wurde ergänzt und native Bibliotheken werden vor Start kontrolliert. Ein erster formatbezogener Tap des nachfolgenden Retests erfolgte vor dem Import-Abschluss auf eine inzwischen verschobene Karte. Native XMLs belegen den noch aktiven Metadatenimport und die veränderte Kartenposition. Der bestehende Abschluss-Guard wird jetzt vor Format-/SAF-Auswahl angewandt. Die gezielte Regression reproduziert den Fehler am alten Treiber, beide neuen Fälle und alle 123 Treibertests bestehen vor Gerätezugriff. Die exakten nativen Titel-, Positions-, Byte- und Touchflächenassertions bleiben erhalten.

## Gesicherte Referenz und Arbeitsstand

Die Referenz-APK `70275c7` mit Digest `f1d587e8…` bleibt wegen des manuell belegten Headerfehlers nicht freigegeben. Ihr Matrixlauf [38606155940](https://github.com/k1w1-a0style/musik-player/actions/runs/38606155940) enthält alle 36 Referenzfälle, Artefakt 11916211717 / Archiv-SHA-256 `09ff4d5f98570ced63644927fbc39770b252da36b0614f0a8ba3428164a59fdf`. Detaillierte Stufen-, Diagnose- und Commitbelege bleiben in [CODEX-V5-CHECKPOINTS.md](CODEX-V5-CHECKPOINTS.md).

Lokale wertvolle Entwürfe wurden vor dem Ausfall durch Patch/Stash/Commit gesichert. Der Work-Befehlsdienst antwortet zeitweise nicht; GitHub-Prüfungen laufen unabhängig. Ein früherer Codex-Abbruch nennt ein Nutzungslimit. Ein allgemeiner Pluginfehler ist nicht nachgewiesen. QA Wolf wurde nicht verwendet; es läuft kein zweiter schreibender Agent. `main` bleibt unverändert bei `b62b91b59c7400fd310a5db8fcbf9fc6444ff393`.

## Messgrenzen und verbleibende Ideen

Es wurden keine Original-Musikdateien verändert. Die kompakte Übergabe enthält 21 Referenz-Tagdatensätze, keine Original-Audiobytes. Physische Android-Schreibtests verwenden generierte Musik und Sidecars. Unsichere Rename-/FLAC-/Website-/Unknownframe-Rewrites bleiben hinter ihrem vorhandenen nativen Vertrag auf Vorschau/Export begrenzt. Eine Sammlungssicherung enthält keine Audiodateien; transaktionale Recovery ist kein späteres Audio-Undo.

Die vorhandenen JS-Quickscan-Profile messen echte JS-Pfade mit sofortigen Providerdoubles. Sie ersetzen keine A50-CPU-/RAM-/Jank-/Provider-IO-Baseline. Eine neue A50-Hardwaremessung, tatsächlich gesprochene TalkBack-Abnahme und vollständige externe Providermatrix wurden nicht durchgeführt und werden nicht als bestanden ausgegeben. Folgeideen: A50-Profiling, langsame/tiefe/abbrechende SAF-Provider, weitere sichere native Tag-Container und dauerhaftes Audio-Undo mit Platzbudget.
