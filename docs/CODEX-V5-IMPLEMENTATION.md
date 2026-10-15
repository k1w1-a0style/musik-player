# Musikplayer – V5-Abnahmebericht, 15.10.2026

**Aktueller Arbeitsstand: Der letzte Bibliotheksleisten-Blocker ist im produktiven Code korrigiert und gezielt auf dem Host geprüft. Eine neue APK mit zuerst zwölf gezielten Gerätefällen und anschließender vollständiger Abnahme steht aus. Noch keine neue APK-Freigabe.**

Die folgenden Prüfergebnisse beziehen sich ausdrücklich auf die historische APK30d5b9e1; sie werden nicht auf geänderte APK-Bytes übertragen. Der Code-/Prüffortschritt steht in CODEX-V5-CHECKPOINTS.md.

Der erfolgreiche Lauf [38622542676](https://github.com/k1w1-a0style/musik-player/actions/runs/38622542676) und das Artefakt [11923644166](https://github.com/k1w1-a0style/musik-player/actions/runs/38622542676/artifacts/11923644166) wurden unabhängig heruntergeladen und geprüft. Es wurden keine Android-Matrix, kein kompletter CI-Lauf und kein APK-Build erneut gestartet. Die ausgelieferte Datei ist exakt die dort geprüfte APK; sie wird als Android-getestete Referenz, nicht als mängelfreie finale Freigabe ausgegeben.

## Exakte noch fehlende Freigabebedingung

Bei **200-%-Schriftgröße auf 320 dp** wird die Bibliotheks-Schaltfläche **„Abspielen“** in der Leiste neben Ansicht/Sortierung abgeschnitten. Dies betrifft **alle zwölf** gespeicherten Kombinationen aus hell/dunkel, graphite/minimal/neon-cover und Standard/Kompakt.

Konkreter Nachweis: `library-2.0-light-minimal-compact.png` und zugehörige XML im Abnahmeartefakt. Der app-eigene native Knoten `library-play-button` hat Bounds **[466,281][480,335]**, also **14 Pixel sichtbare Breite**. Die Leiste ist kein horizontaler Scrollbereich. Der Button erscheint in der Screenshot-Sichtkontrolle nicht als vollständig bedienbare Schaltfläche. Ein realer Layoutmangel ist damit nachgewiesen; er ist kein Scroll-/ADB-Fehler des Treibers.

Der Quellstand enthält eine feste 36-dp-Zeile in `components/LibrarySectionHeader.tsx`, vergrößerbare Titel und eine nicht umbrechende Aktionszeile. Der verfügbare Platz reicht bei großer Schrift nicht für alle Aktionen. Vor vollständiger Freigabe muss diese Leiste responsiv werden und die tatsächliche Erreichbarkeit der vollständigen „Abspielen“-Fläche nachgewiesen werden.

**Warum die grüne Matrix das nicht verhindert:** Sie prüft alle 36 Varianten, native Auswahlzustände, Songkarten-Menüflächen sowie die korrigierten Header-Schaltflächen. Sie enthält keinen vollständigen Flächen-Guard für `library-play-button`. Die erfolgreichen Assertions bleiben gültig; sie wurden nicht abgeschwächt. Die manuelle Sichtkontrolle ist eine zusätzliche Freigabebedingung und fällt hier durch.

Suche und Hauptmenü des zuvor korrigierten Headers sind in allen 36 Fällen vollständig und jeweils 48 dp groß. Der ursprüngliche Settings-Scrollfehler ist behoben. Die alten 26+10 Referenzfälle wurden nicht für diese neue APK wiederverwendet.

## APK-Identität

| Eigenschaft | Verifizierter Wert |
|---|---|
| App-/Buildquelle | `30d5b9e1e7df11cb86e30545b3789a8fd29fc995` |
| APK SHA-256 | `f3b7d6a778aec4c90585d0e2a8a1ae3411f8703a4d8a93be11acaec5ad8e888c` |
| APK-Größe | 100.825.509 Bytes |
| APK-Artefakt | [11921651317](https://github.com/k1w1-a0style/musik-player/actions/runs/38616633219/artifacts/11921651317) |
| APK-Archiv SHA-256 | `0c4a83ee3eacd6dfc6a89d6843ebfb6fa0cb04493b9c902bed1aeef88217b3df` |
| Abnahme-Harness | `aa68e02d9c559e408d24e3554d4f9085108e99c7` |
| Abnahme-Archiv SHA-256 | `2ef461e8513f59e3f50607a7673d8c5042d1f842fc16b6757d9b508153c4e435` |
| Package / Version | `com.k1w1a0style.musikplayer` / 1.0.0, Code 1 |
| Plattformen | minSDK 24, targetSDK 36; arm64-v8a, armeabi-v7a, x86, x86_64 |
| Signatur | APK-v2; RSA-Signatur, Zertifikat und signierter Inhalts-Digest unabhängig geprüft |
| Zertifikat SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |

Es handelt sich um die bestehende Preview-Testsignatur. Eine private Store-/Produktionssignierung wird nicht behauptet. Beide heruntergeladenen Archive entsprechen ihren GitHub-Digests und bestehen die vollständige ZIP-Integritätsprüfung.

## Erfolgreich geprüfte Pakete

| Paket | Nachweis |
|---|---|
| Qualität | 427 Jest-Suiten / 4.133 Tests; 121 Python-Tests der APK-Quelle, 123 Tests des finalen Abnahmetreibers; TypeScript, strenger ESLint, Expo-, NUL-, Komplexitäts-, Hermes-/Bundle- und Manifestgates erfolgreich |
| Coverage | 92,92 % Statements; 85,31 % Branches; 94,03 % Functions; 95,98 % Lines |
| Android-Build / Native | Release-Build; 168 SystemAudio- und 10 RNTP-Tests; unabhängige JUnit-Lesung: 178 Tests, 0 Fehler, 0 Fehlversuche, 0 übersprungen |
| Scan und Import | Öffentlicher MediaStore-/SAF-Import; terminaler Scan-ACK vor Auswahl; optionale Waveform-Cancellation mit drei terminalen ACK-Frames; bestehende Race-/Epoch-/Persistenz-Gates |
| Formate / Queue | MP3, M4A, FLAC und SAF mit tatsächlichem nativen Positionsfortschritt; Queue 2→5; echte Drag-/Cover-Gesten und Hintergrundwiedergabe |
| Resume | Ein/Aus nach echtem Prozessneustart; gespeicherte Position 257 s, Start 257,018 s, pausiert 265,733 s; native Zeit- und ±3-s-Abgleiche bestanden |
| Backup/Restore | SAF-Export unabhängig gelesen; read-only Inspection, Preview, additive Kopie; Original und Kopie mit Reihenfolge/IDs sowie Favorit nach Kaltstart geprüft |
| Farben | Je zwölf öffentliche Optionen für App/Player/Waveform, drei verschiedene persistierte Werte, sofortiger Wechsel und beide Playerlayouts |
| Tag-Cleaner | Synthetischer SAF-Write; Vorschau/Display-only unverändert, Kaltstart und Idempotenz, saubere physische Titel-/Interpretänderung; Audio, APIC, TPUB, WXXX, beide ReplayGain-TXXX, XKIW und .lrc bytegleich erhalten |
| Automatisierte UI-Abnahme | 36/36 Kombinationen; 108 echte PNG/XML-Paare; Header-Preflight 100/200 %, vollständige 48-dp-Headerflächen in allen Fällen; keine alten APK-Fälle eingesetzt |
| Laufzeit | `result.json: status=passed`; keine FATAL-, app-eigene ANR-, ErrorBoundary- oder GestureHandler-Ausnahme im nativen Abschlusslog |

Die vollständige Android-Abnahme dauerte vom Funktionstestbeginn bis zur letzten Matrixprüfung rund 29 Minuten. Sie war bereits abgeschlossen, während die lokale Arbeitsumgebung zeitweise nicht antwortete.

### Unabhängiger Dateierhalt beim Cleaner

Original: `e13be3f15bbfcf0edb4795a30cefdd7c3fc2df75d4075c662ee8425fc841e403`; Ergebnis: `52af83343fefdf327132edb01c2e8548dab16d80de10c7f3c1122b0a1c1c7806`. Encodierte Audioframes vorher/nachher exakt gleich, SHA-256 `18b420012bef6db2dc00075a558639f89b56778fd13fc9f6768f41e5729fc3d0`. ffprobe bestätigt MP3, Cover und 75,075918 s. Sidecar vorher/nachher identisch, SHA-256 `1a134e289fcb2e27a7973df560d03fc3600e40d5a3f073ebfd619bff105f2638`.

## Sicherheit und Herkunft der roten Source-CI

[Source-CI 38616633219, Versuch 2](https://github.com/k1w1-a0style/musik-player/actions/runs/38616633219/attempts/2) hat drei erfolgreiche unabhängige Gates für exakt den APK-Commit: Qualität, Security und nativer Build. Ihr damaliger UI-Job brach beim Emulator-Download vor Appstart ab; die gesamte Source-CI wird deshalb nicht als grün bezeichnet. Der später erfolgreiche, eigenständige Retest bestätigt die vollständige öffentliche Android-Abnahme derselben APK-Bytes und unveränderten Appdateien.

Produktionsaudit: **0 kritisch, 23 hoch, 5 moderat**. Die strikte Policy bestätigt die zwei bestehenden kompensierten Advisory-Wurzeln und 21 transitive Effekte aus [Issue #396](https://github.com/k1w1-a0style/musik-player/issues/396). Die Ausnahmen sind unverändert bis **21.10.2026** befristet. Keine neue oder verlängerte Ausnahme; kein behaupteter Null-Befund. Test-, Sicherheits- und Herkunftsgates wurden nicht abgeschwächt.

## Arbeitsstand und Grenzen

Der lokale Befehlsdienst ist wieder arbeitsfähig. Keine lokalen Emulator-/ADB-/Jest-/Gradle-Prozesse oder ungesicherten Projektdateien wurden vorgefunden. Automatische Wartung hatte den alten Arbeitsordner entfernt; veröffentlichte Änderungen und immutable Artefakte wurden gezielt wiederhergestellt. Der zuvor veröffentlichte Stand `d2296872` enthält die abgeschlossenen Korrekturen; dieser Bericht aktualisiert nur Dokumentation. `main` bleibt unverändert bei `b62b91b59c7400fd310a5db8fcbf9fc6444ff393`. QA Wolf wurde nicht verwendet.

Keine Original-Musikdateien wurden verändert. Die kompakte Übergabe enthält 21 Referenz-Tagdatensätze; physische Tests verwenden generierte Musik/Sidecars. Unsichere Rename-/FLAC-/Website-/Unknownframe-Rewrites bleiben hinter dem vorhandenen nativen Vertrag auf Vorschau/Export begrenzt. Sammlungssicherungen enthalten keine Audiodateien; transaktionale Recovery ist kein späteres Audio-Undo.

Es gibt keine neue Samsung-A50-CPU-/RAM-/Jank-/Provider-IO-Baseline, tatsächlich gesprochene TalkBack-Abnahme oder vollständige externe Providermatrix. Vorhandene JS-Quickscanprofile mit Providerdoubles ersetzen diese Hardwaremessungen nicht. Diese Grenzen bleiben ausdrücklich ausgewiesen. Folgeideen sind A50-Profiling, langsame/tiefe/abbrechende SAF-Provider, weitere sichere native Tag-Container und dauerhaftes Audio-Undo mit Platzbudget.

**Abschlussstatus:** automatisierte Abnahme und unabhängige Nachweisprüfung abgeschlossen; **V5 insgesamt nicht freigegeben**. Die fehlende konkrete Freigabebedingung ist die vollständig erreichbare Bibliotheks-Schaltfläche „Abspielen“ bei 200-%-Schrift. Kein neuer Build und kein erneuter Kompletttest wurden für diesen Abschluss gestartet.
