# Musikplayer – finaler V5-Abnahmebericht, 15.10.2026

**V5 abgeschlossen und die korrigierte APK freigegeben.** Der zuletzt nachgewiesene Bibliotheksleisten-Fehler bei 200 % Schrift ist behoben. Die neue APK hat zuerst die zwölf betroffenen Varianten und anschließend die vollständige Funktions-/36er-Abnahme bestanden. Die unabhängige Artefaktprüfung und die Sichtkontrolle der zwölf großen Bibliotheksleisten sind erfolgreich. Insgesamt wurden alle 108 Bibliotheks-/Einstellungs-/Playerbilder gesichtet; ein nicht blockierender zusätzlicher Infohinweis ist unten ausdrücklich dokumentiert.

## Änderung und gezielte Regression

`LibrarySectionHeader.tsx` verwendet automatische Höhe, umbrechende Titel-/Aktionszeilen und auf die verfügbare Breite begrenzte Inhalte. Ansicht und Sortierung wachsen mit dem Text; Abspielen und Zufallswiedergabe haben nicht schrumpfende 48-dp-Flächen. Es gibt keine Verkleinerung oder Begrenzung der Schrift. Titel und Aktionen überlappen nicht.

Zwei neue Jest-Regressionen reproduzierten zunächst die feste 36-dp-Höhe und die zu kleinen Buttons. Nach der Korrektur bestanden 19 gezielte Tests aus fünf betroffenen Suiten. Der Gerätetest verlangt für alle vier Bibliotheksleisten-Aktionen mindestens 48 dp, vollständige Sichtbarkeit innerhalb der eigenen Leiste und des Bildschirms sowie aktivierten App-Owner und paarweise überlappungsfreie Bounds einschließlich Titel. Abspielen wird in jeder Variante tatsächlich betätigt und die native FLAC-Session PLAYING bestätigt.

## Exakte APK und Nachweise

| Eigenschaft | Geprüfter Wert |
|---|---|
| APK-Quellcommit | `c47b27f6fee2fd826cb3ea023ce4b1aafdb59b06` |
| APK SHA-256 | `91ba080aa732bd2e0af1bf437c53bc90ca6179d9d814fd26c596cec3ef0e18fc` |
| APK-Größe | 100825769 Bytes |
| APK-Artefakt | [11990344146](https://github.com/k1w1-a0style/musik-player/actions/runs/38766310237/artifacts/11990344146) |
| Source-CI | [38766310237](https://github.com/k1w1-a0style/musik-player/actions/runs/38766310237), Versuch 1 |
| Vollständige unabhängige Android-Abnahme | [38777723098](https://github.com/k1w1-a0style/musik-player/actions/runs/38777723098) |
| Erfolgreiche gezielte zwölf Fälle | [38773283526](https://github.com/k1w1-a0style/musik-player/actions/runs/38773283526), Artefakt 11994031824, Harness f5ff31be; nach strikter Herkunftsprüfung ohne Wiederholung erhalten |
| Abnahme-Harness | `49e0f183e859bfd124792f3e6ac734fa30b633b4` |
| Abnahme-Artefakt | [11995983715](https://github.com/k1w1-a0style/musik-player/actions/runs/38777723098/artifacts/11995983715) |
| Abnahme-ZIP SHA-256 | `e5d40365a23dae9248f5f13cbab8169d06f5b937b1acab97bce32e9828172694` |
| Package / Version | `com.k1w1a0style.musikplayer` / 1.0.0, Code 1 |
| Android | minSDK 24, targetSDK 36; arm64-v8a, armeabi-v7a, x86, x86_64 |
| Signatur | APK-v2; RSA-Signatur, Zertifikat und signierter Inhalts-Digest unabhängig an den tatsächlichen APK-Bytes geprüft |
| Zertifikat SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |

Die bestehende Preview-Testsignatur bleibt erhalten; eine private Store-Signierung wird nicht behauptet. APK- und Nachweisarchive wurden mit GitHub-Digests und vollständiger ZIP-Integritätsprüfung abgeglichen. Die ausgelieferte APK ist bytegleich mit der in beiden neuen Gerätestufen verwendeten Datei.

## Abnahmeergebnisse der neuen APK

| Paket | Ergebnis |
|---|---|
| Qualität | 427 Jest-Suiten / 4.135 Tests; 126 Python-Tests der APK-Quelle und 134 Tests des finalen Abnahmetreibers |
| Weitere Source-Gates | TypeScript, strenger ESLint, Expo-Kompatibilität, NUL-/Komplexitäts-, Android-Bundle-/Manifestgates erfolgreich |
| Coverage | 92,92 % Statements; 85,30 % Branches; 94,03 % Functions; 95,98 % Lines |
| Nativer Build / Tests | Release-Build; 168 SystemAudio- und 10 RNTP-Tests; unabhängige JUnit-Lesung: 178 Tests, keine Fehler, Fehlversuche oder übersprungenen Tests |
| Gezielte Gerätefälle zuerst | 12/12 bei 200 % Schrift; alle Leisten-Aktionen mindestens 48 dp und ohne Überlappung; tatsächliche native Abspielbestätigung je Fall |
| Frische vollständige Geräteabnahme | 36/36 aus Schrift 100/130/200 %, hell/dunkel, drei Skins, Standard/Kompakt; 108 PNG/XML-Paare; zusätzliche Header-/Leisten-Geometrie und native Abspielaktion in jedem Fall |
| Sichtkontrolle | Alle zwölf Bibliotheksvarianten bei 200 % Schrift anhand der neuen Original-Screenshots geprüft; Titel und Aktionen vollständig, kein Abschneiden und keine Überlappung |
| Scan / Import | Öffentlicher MediaStore-/SAF-Import, terminaler Scan-ACK und optionale Waveform-Cancellation geprüft |
| Formate / Queue | MP3, M4A, FLAC und SAF mit tatsächlichem nativen Positionsfortschritt; Queue 2→5, Drag-/Cover-Gesten und Hintergrundwiedergabe |
| Resume | Ein/Aus nach Prozessneustart; gespeicherte/native/UI-Zeit mit unverändertem ±3-s-Abgleich unabhängig bestätigt |
| Backup / Restore | SAF-Export unabhängig gelesen; read-only Inspection, Preview und additive Kopie; Original/Kopie mit Reihenfolge, IDs und Favorit nach Kaltstart |
| Farben | Je zwölf öffentliche Optionen für App/Player/Waveform, drei verschiedene persistierte Werte, Sofortwechsel und beide Playerlayouts |
| Tag-Cleaner | Generierter SAF-Write, Vorschau/Display-only unverändert, Kaltstart/Idempotenz; physische Titel-/Interpretänderung bei bytegleichem Audio, APIC, TPUB, WXXX, ReplayGain-TXXX, XKIW und .lrc; unabhängige ID3-/ffprobe-Prüfung |
| Laufzeit | `release-interaction/result.json: status=passed`; kein FATAL-/App-ANR-/ErrorBoundary-/GestureHandler-Befund im Abschlusslog |

Alle Gerätefälle stammen aus der neuen APK. Die historische Abnahme 38622542676 der APK30d5b9e1 bleibt als Referenz erhalten und wurde nicht übertragen. Auch die zwölf gezielten Fälle ersetzen keine Fälle der anschließend frisch gestarteten vollständigen Abnahme.

## CI- und Treiberbefunde

Die drei erforderlichen Source-Gates Qualität, Security und nativer Build sind für exakt c47b27f6 erfolgreich. Die gesamte Source-CI ist wegen ihres ersten UI-Treiberfehlers rot und wird ausdrücklich nicht als grün bezeichnet. Der erste Gerätefall hatte die reparierte Geometrie und native Wiedergabe bereits bestätigt; danach suchte der Treiber ein bei laufender Wiedergabe absichtlich verborgenes Pausezustands-Control. Der korrigierte Treiber bedient die öffentliche Pausieren-Fläche und verlangt anschließend den unveränderten nativen PAUSED-ACK. Der System-Dateidialog wird nur nach drei vollständig innerhalb seines Owners liegenden stabilen Geometrie-Frames bedient; kurzzeitig versetzte Animationsframes werden innerhalb des unveränderten 25-s-Budgets erneut gelesen, dauerhaft abgeschnittene Pfade bleiben ein Fehler. Zusätzlich wartet der Settings-Einstieg auf den stabilen eigenen Header und die tatsächlich geöffnete eigene Menükarte, bevor er scrollt.

Diese ausschließlich am Treiber vorgenommenen Korrekturen erhielten Red-/Green-Regressionen. Die unabhängige finale Abnahme prüft unveränderte Appdateien gegenüber c47b27f6, exakt dieselben APK-Bytes und die drei erfolgreichen Source-Gates. Es gab dafür keinen weiteren APK-Build und keine Wiederholung der vollständigen Jest-/Native-Suiten. Keine Assertion und kein Sicherheitsgate wurden abgeschwächt.

## Nicht blockierender optischer Restpunkt

Im SoundCloud-Player wird der zusätzliche Textchip „Infos zu diesem Track“ bei 200 % Schrift durch die feste Metadatenhöhe vertikal gekürzt (40 Pixel sichtbar). Dies wird nicht als mängelfreie Darstellung ausgegeben. Die identische Infofunktion bleibt über den oberen und unteren Info-Button vollständig erreichbar: Beide sind in allen zwölf nativen XMLs aktiviert, app-eigen, innerhalb des Bildschirms und jeweils 72 × 72 Pixel = 48 dp groß; beide binden denselben Info-Handler. Der Befund betrifft damit einen redundanten Hinweis, keinen Verlust einer erforderlichen Aktion. Er ist als optische Folgeverbesserung dokumentiert und löst keinen neuen Build aus. Die Freigabe behauptet keine völlige optische Fehlerfreiheit.

## Sicherheit und verbleibende Grenzen

Produktionsaudit: **0 kritisch, 23 hoch, 5 moderat**. Die strikte Policy bestätigt die zwei bestehenden kompensierten Advisory-Wurzeln und 21 transitive Effekte aus [Issue #396](https://github.com/k1w1-a0style/musik-player/issues/396). Die Ausnahmen sind unverändert bis **21.10.2026** befristet. Kein neuer oder verlängerter Ausnahmefall und kein behaupteter Null-Befund. Der notwendige minimale SDK57-Patch auf Expo57.0.30 änderte vier exakt geprüfte Lockfile-Pakete; RN0.86.3 und RNTP5.12.1 bleiben unverändert.

Keine Original-Musikdateien wurden verändert. Die kompakte Übergabe enthält 21 Referenz-Tagdatensätze; physische Tests verwenden generierte Musik/Sidecars. Unsichere Rename-/FLAC-/Website-/Unknownframe-Rewrites bleiben hinter dem vorhandenen nativen Vertrag auf Vorschau/Export begrenzt. Sammlungssicherungen enthalten keine Audiodateien; transaktionale Recovery ist kein späteres Audio-Undo.

Keine neue Samsung-A50-CPU-/RAM-/Jank-/Provider-IO-Baseline, tatsächlich gesprochene TalkBack-Abnahme oder vollständige externe Providermatrix wird behauptet. JS-Quickscanprofile mit Providerdoubles ersetzen diese Hardwaremessungen nicht. Diese bereits ausgewiesenen Grenzen bleiben erhalten; sie sind keine neu nachgewiesenen Produktregressionen. QA Wolf wurde nicht verwendet.

**Abschluss:** Kein offener nachgewiesener Freigabeblocker für die erforderlichen Funktionen und die korrigierte Bibliotheksleiste; der nicht blockierende zusätzliche Infohinweis bleibt ausdrücklich ausgewiesen. V5 ist mit den oben ausgewiesenen Nachweisen und Grenzen abgeschlossen. Änderungen und Abschlussdokumentation liegen ausschließlich auf `codex`; `main` bleibt bei `b62b91b59c7400fd310a5db8fcbf9fc6444ff393` unverändert.
